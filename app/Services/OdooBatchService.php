<?php

namespace App\Services;

use App\Models\DispatchLog;
use Carbon\Carbon;

/**
 * Convierte los OUT de un batch de Odoo en las mismas filas que hoy trae el Excel de ruta:
 * 0 guía, 1 producto, 2 cantidad, 3 identificación, 4 contacto, 5 teléfono, 6 email,
 * 7 dirección, 8 hora final, 9 prioridad, 10 info.
 * Solo consulta Odoo; no escribe nada.
 */
class OdooBatchService
{
    /** Campo de hora final, en orden de preferencia (validado con BATCH/87742 y 87743). */
    private const DEADLINE_FIELDS = ['sale.commitment_date', 'picking.date_deadline', 'picking.scheduled_date'];

    /** Info para el mensajero: la nota del pedido de venta, como en el Excel exportado. */
    private const INFO_FIELDS = ['sale.note', 'picking.note'];

    private const PICKING_STATES = [
        'draft' => 'Borrador', 'waiting' => 'En espera', 'confirmed' => 'En espera',
        'assigned' => 'Listo', 'done' => 'Hecho', 'cancel' => 'Cancelado',
    ];

    public function __construct(private OdooClient $odoo)
    {
    }

    /**
     * Filas del rutero y nombre completo del batch en Odoo.
     *
     * @return array{batch: string, rows: array}
     */
    public function rows(string $batch): array
    {
        $data = $this->load($batch);
        return ['batch' => $data['batch'], 'rows' => $data['rows']];
    }

    /** Resumen, guías y advertencias para revisar antes de generar el rutero. */
    public function preview(string $batch): array
    {
        $data = $this->load($batch);

        $warnings = [];
        foreach ($data['guides'] as $g) {
            if (!$g['address']) {
                $warnings[] = "{$g['guide']}: sin dirección de entrega.";
            }
            if (!$g['has_phone']) {
                $warnings[] = "{$g['guide']}: sin teléfono.";
            }
            if (!in_array($g['state_code'], ['assigned', 'done'])) {
                $warnings[] = "{$g['guide']}: el OUT está en estado {$g['state']}.";
            }
            if ($g['lines'] === 0) {
                $warnings[] = "{$g['guide']}: no tiene productos.";
            }
        }
        if (DispatchLog::where('source_batch', $data['batch'])->whereDate('created_at', today())->exists()) {
            array_unshift($warnings, "El batch {$data['batch']} ya se usó hoy para generar otra ruta.");
        }

        return [
            'batch' => $data['batch'],
            'guides_count' => count($data['guides']),
            'lines_count' => count($data['rows']),
            'guides' => array_map(fn($g) => array_intersect_key($g, array_flip(['guide', 'customer', 'city', 'lines', 'state', 'priority'])), $data['guides']),
            'warnings' => $warnings,
        ];
    }

    private function load(string $batchInput): array
    {
        $batch = $this->findBatch(trim($batchInput));

        $pickingFields = $this->odoo->existingFields('stock.picking', ['name', 'origin', 'partner_id', 'scheduled_date', 'date_deadline', 'priority', 'note', 'state', 'sale_id', 'picking_type_code']);
        $pickings = collect($this->odoo->read('stock.picking', $batch['picking_ids'], $pickingFields))
            ->filter(fn($p) => ($p['picking_type_code'] ?? 'outgoing') === 'outgoing' && ($p['state'] ?? '') !== 'cancel')
            ->sortBy(fn($p) => array_search($p['id'], $batch['picking_ids'])) // mismo orden del batch
            ->values();

        if ($pickings->isEmpty()) {
            throw new OdooException("El batch {$batch['name']} no tiene entregas (OUT) activas.");
        }

        $moves = collect($this->odoo->searchRead('stock.move', [['picking_id', 'in', $pickings->pluck('id')->all()], ['state', '!=', 'cancel']], ['picking_id', 'product_id', 'product_uom_qty', 'description_picking'], ['order' => 'id']))
            ->groupBy(fn($m) => $m['picking_id'][0]);

        $products = collect($this->odoo->read('product.product', $moves->flatten(1)->map(fn($m) => $m['product_id'][0])->all(), ['name']))->keyBy('id');

        $partnerFields = $this->odoo->existingFields('res.partner', ['display_name', 'name', 'vat', 'phone', 'mobile', 'email', 'contact_address_complete', 'street', 'street2', 'zip', 'city', 'state_id', 'country_id']);
        $partners = collect($this->odoo->read('res.partner', $pickings->map(fn($p) => $this->id($p['partner_id'] ?? false))->filter()->all(), $partnerFields))->keyBy('id');

        $saleIds = $pickings->map(fn($p) => $this->id($p['sale_id'] ?? false))->filter()->all();
        $sales = $saleIds
            ? collect($this->odoo->read('sale.order', $saleIds, $this->odoo->existingFields('sale.order', ['name', 'commitment_date', 'note'])))->keyBy('id')
            : collect();

        $rows = [];
        $guides = [];
        foreach ($pickings as $p) {
            $partner = $partners[$this->id($p['partner_id'] ?? false)] ?? [];
            $sale = $sales[$this->id($p['sale_id'] ?? false)] ?? [];
            $guide = $this->text($p['origin'] ?? null) ?: $p['name'];
            // Como el Excel exportado: teléfono; si no hay, el celular (el export lo dejaba vacío)
            $phone = $this->text($partner['phone'] ?? null) ?: $this->text($partner['mobile'] ?? null);
            $address = $this->address($partner);
            $priority = ($p['priority'] ?? '0') === '1' ? 'Urgente' : 'Normal';
            $deadline = $this->pick(self::DEADLINE_FIELDS, $p, $sale);
            $info = (string) $this->pick(self::INFO_FIELDS, $p, $sale);

            $lines = $moves[$p['id']] ?? collect();
            foreach ($lines as $m) {
                $rows[] = [
                    $guide,
                    $this->productName($m, $products),
                    $this->quantity($m['product_uom_qty']),
                    $this->text($partner['vat'] ?? null),
                    $this->text($partner['display_name'] ?? $partner['name'] ?? null),
                    $phone,
                    $this->text($partner['email'] ?? null),
                    $address,
                    $deadline ? $this->toLocal($deadline) : '',
                    $priority,
                    $info,
                ];
            }

            $guides[] = [
                'guide' => $guide,
                'customer' => explode(',', $this->text($partner['display_name'] ?? $partner['name'] ?? null))[0],
                'city' => $this->text($partner['city'] ?? null),
                'lines' => $lines->count(),
                'state_code' => $p['state'] ?? '',
                'state' => self::PICKING_STATES[$p['state'] ?? ''] ?? ($p['state'] ?? ''),
                'priority' => $priority,
                'address' => $address,
                'has_phone' => (bool) $phone,
            ];
        }

        return ['batch' => $batch['name'], 'rows' => $rows, 'guides' => $guides];
    }

    /** Acepta el nombre completo (BATCH/01234) o solo el número final. */
    private function findBatch(string $input): array
    {
        if ($input === '') {
            throw new OdooException('Escribe el número de batch.');
        }

        $found = $this->odoo->searchRead('stock.picking.batch', [['name', '=ilike', $input]], ['name', 'picking_ids'], ['limit' => 2]);
        if (!$found) {
            $found = $this->odoo->searchRead('stock.picking.batch', [['name', '=ilike', '%/' . ltrim($input, '/')]], ['name', 'picking_ids'], ['limit' => 2]);
        }

        if (!$found) {
            throw new OdooException("No se encontró el batch \"{$input}\" en Odoo.");
        }
        if (count($found) > 1) {
            throw new OdooException("Hay varios batch que terminan en \"{$input}\". Escribe el nombre completo.");
        }

        return $found[0];
    }

    /** Primer valor no vacío entre los campos "picking.x" o "sale.x" indicados. */
    private function pick(array $fields, array $picking, array $sale)
    {
        foreach ($fields as $field) {
            [$model, $name] = explode('.', $field);
            $value = ($model === 'sale' ? $sale : $picking)[$name] ?? null;
            if ($value !== null && $value !== false && trim(strip_tags((string) $value)) !== '') {
                return $value;
            }
        }
        return null;
    }

    /**
     * Descripción de la línea como en el Excel exportado (description_picking: nombre del producto
     * y su descripción para entregas, si la tiene); si falta, el nombre sin [código].
     */
    private function productName(array $move, $products): string
    {
        // Se conserva el texto tal cual (Odoo guarda algunos nombres con dobles espacios); solo se quitan saltos de línea
        $description = trim(str_replace(["\r\n", "\n"], ' ', $this->text($move['description_picking'] ?? null)));
        $name = $products[$move['product_id'][0]]['name'] ?? preg_replace('/^\[[^\]]*\]\s*/', '', $move['product_id'][1]);

        return $description !== '' ? preg_replace('/^\[[^\]]*\]\s*/', '', $description) : $name;
    }

    /** Dirección completa de Odoo, como en el Excel exportado; si no existe el campo, se arma. */
    private function address(array $partner): string
    {
        $complete = trim(preg_replace('/\s*\n\s*/', ', ', $this->text($partner['contact_address_complete'] ?? null)), ', ');
        if ($complete !== '') {
            return $complete;
        }

        $street = trim($this->text($partner['street'] ?? null) . ' ' . $this->text($partner['street2'] ?? null));
        $city = trim($this->text($partner['zip'] ?? null) . ' ' . $this->text($partner['city'] ?? null));
        $parts = [$street, $city, $this->text(($partner['state_id'] ?? [null, null])[1] ?? null), $this->text(($partner['country_id'] ?? [null, null])[1] ?? null)];

        // Odoo muestra el departamento como "Cundinamarca (CO)"
        $parts[2] = preg_replace('/\s*\([A-Z]{2}\)$/', '', $parts[2]);

        return implode(', ', array_filter($parts, fn($s) => $s !== ''));
    }

    /** Odoo entrega fechas en UTC sin zona; se pasan a la hora local. */
    private function toLocal(string $utc): string
    {
        return Carbon::parse($utc, 'UTC')->setTimezone(config('services.odoo.timezone', 'America/Bogota'))->format('Y-m-d H:i:s');
    }

    private function quantity($qty)
    {
        return floor((float) $qty) == (float) $qty ? (int) $qty : (float) $qty;
    }

    private function id($many2one): ?int
    {
        return is_array($many2one) ? (int) $many2one[0] : null;
    }

    /** Odoo devuelve false para campos vacíos. */
    private function text($value): string
    {
        return $value === false || $value === null ? '' : trim((string) $value);
    }
}
