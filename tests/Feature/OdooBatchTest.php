<?php

namespace Tests\Feature;

use App\Models\DispatchLocation;
use App\Models\DispatchLog;
use App\Models\Messenger;
use App\Models\User;
use App\Services\OdooBatchService;
use App\Services\OdooException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

/**
 * Rutero desde un batch de Odoo, con respuestas JSON-RPC simuladas (datos ficticios).
 */
class OdooBatchTest extends TestCase
{
    use RefreshDatabase;

    /** Respuesta simulada de la importación de DispatchTrack y rutas del día. */
    private array $importResponse = ['status' => 'ok', 'response' => 'Added to queue'];
    private array $todayRoutes = [];

    /** Métodos que la integración tiene permitido llamar en Odoo. */
    private const READ_METHODS = ['search_read', 'read', 'search_count', 'fields_get'];

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.odoo' => [
            'url' => 'https://odoo.test', 'db' => 'lfh', 'username' => 'bot@lfh.test', 'api_key' => 'clave-de-prueba', 'timezone' => 'America/Bogota',
        ]]);

        Http::fake([
            'odoo.test/*' => fn(Request $request) => Http::response(['jsonrpc' => '2.0', 'id' => 1, 'result' => $this->odoo($request['params'])]),
            // DispatchTrack: importación del rutero y rutas del día
            '*' => fn(Request $request) => str_ends_with(parse_url($request->url(), PHP_URL_PATH), '/import')
                ? Http::response($this->importResponse, ($this->importResponse['status'] ?? '') === 'ok' ? 200 : 400)
                : Http::response(['response' => ['routes' => $this->todayRoutes]]),
        ]);
    }

    /** Odoo simulado: un batch con dos OUT activos, uno cancelado y un IN que se ignoran. */
    private function odoo(array $params)
    {
        if ($params['service'] === 'common') {
            return 7; // uid
        }

        [, , , $model, $method, $args, $kwargs] = $params['args'];

        if ($method === 'fields_get') {
            $fields = [
                'stock.picking' => ['name', 'origin', 'partner_id', 'scheduled_date', 'date_deadline', 'priority', 'note', 'state', 'sale_id', 'picking_type_code'],
                'res.partner' => ['display_name', 'name', 'vat', 'phone', 'email', 'contact_address_complete', 'street', 'street2', 'zip', 'city', 'state_id', 'country_id'], // Odoo 18: sin "mobile"
                'sale.order' => ['name', 'commitment_date', 'note'],
            ][$model];
            return array_fill_keys($fields, ['type' => 'char']);
        }

        return match ($model) {
            'stock.picking.batch' => $args[0][0][2] === 'BATCH/00042' || $args[0][0][2] === '%/00042'
                ? [['id' => 42, 'name' => 'BATCH/00042', 'picking_ids' => [11, 10, 12, 13]]]
                : [],
            'stock.picking' => [
                ['id' => 10, 'name' => 'WH/OUT/0010', 'origin' => 'S000100', 'partner_id' => [500, 'Clínica Demo, Ana Prueba'], 'scheduled_date' => '2026-11-12 15:00:00', 'date_deadline' => false, 'priority' => '1', 'note' => '<p>Entregar en <b>portería</b></p>', 'state' => 'assigned', 'sale_id' => [900, 'S000100'], 'picking_type_code' => 'outgoing'],
                ['id' => 11, 'name' => 'WH/OUT/0011', 'origin' => false, 'partner_id' => [501, 'Pedro Ficticio'], 'scheduled_date' => '2026-11-12 18:30:00', 'date_deadline' => false, 'priority' => '0', 'note' => false, 'state' => 'confirmed', 'sale_id' => false, 'picking_type_code' => 'outgoing'],
                ['id' => 12, 'name' => 'WH/OUT/0012', 'origin' => 'S000102', 'partner_id' => [500, 'x'], 'scheduled_date' => false, 'priority' => '0', 'note' => false, 'state' => 'cancel', 'sale_id' => false, 'picking_type_code' => 'outgoing'],
                ['id' => 13, 'name' => 'WH/IN/0013', 'origin' => false, 'partner_id' => false, 'scheduled_date' => false, 'priority' => '0', 'note' => false, 'state' => 'assigned', 'sale_id' => false, 'picking_type_code' => 'incoming'],
            ],
            'stock.move' => [
                ['id' => 1, 'picking_id' => [10, 'WH/OUT/0010'], 'product_id' => [70, '[A1] PRODUCTO UNO'], 'product_uom_qty' => 3.0],
                ['id' => 2, 'picking_id' => [10, 'WH/OUT/0010'], 'product_id' => [71, '[B2] PRODUCTO DOS'], 'product_uom_qty' => 1.5, 'description_picking' => "PRODUCTO DOS
INV  12345"],
                ['id' => 3, 'picking_id' => [11, 'WH/OUT/0011'], 'product_id' => [70, '[A1] PRODUCTO UNO'], 'product_uom_qty' => 2.0],
            ],
            'product.product' => [['id' => 70, 'name' => 'PRODUCTO UNO'], ['id' => 71, 'name' => 'PRODUCTO DOS']],
            'res.partner' => [
                ['id' => 500, 'display_name' => 'Clínica Demo, Ana Prueba', 'vat' => '900000000-1', 'phone' => '+57 300 0000000', 'email' => 'ana@demo.test', 'contact_address_complete' => 'Cl 1 # 2-3, 110111 Bogotá D.C., Cundinamarca, Colombia', 'street' => 'ignorada', 'street2' => false, 'zip' => false, 'city' => 'Bogotá D.C.', 'state_id' => false, 'country_id' => false],
                ['id' => 501, 'display_name' => 'Pedro Ficticio', 'vat' => false, 'phone' => false, 'email' => 'pedro@demo.test', 'street' => false, 'street2' => false, 'zip' => false, 'city' => false, 'state_id' => false, 'country_id' => false],
            ],
            'sale.order' => [['id' => 900, 'name' => 'S000100', 'commitment_date' => '2026-11-12 18:00:00', 'note' => '<p>Llamar al llegar</p><p>// Portería</p>']],
        };
    }

    public function test_maps_the_out_pickings_of_a_batch_to_route_rows(): void
    {
        ['batch' => $batch, 'rows' => $rows] = app(OdooBatchService::class)->rows('00042');

        $this->assertSame('BATCH/00042', $batch);
        // Orden del batch (11 antes que 10); el cancelado y el IN no aparecen
        $this->assertSame(['WH/OUT/0011', 'S000100', 'S000100'], array_column($rows, 0));

        [$pedro, $uno, $dos] = $rows;
        $this->assertSame(['PRODUCTO UNO', 3, '900000000-1', 'Clínica Demo, Ana Prueba', '+57 300 0000000', 'ana@demo.test'], array_slice($uno, 1, 6));
        $this->assertSame('Cl 1 # 2-3, 110111 Bogotá D.C., Cundinamarca, Colombia', $uno[7]);
        $this->assertSame('2026-11-12 13:00:00', $uno[8], 'commitment_date en UTC pasa a hora de Bogotá');
        $this->assertSame(['Urgente', 'Urgente'], [$uno[9], $dos[9]], 'la prioridad aplica a todas las líneas de la guía');
        $this->assertSame(1.5, $dos[2]);
        $this->assertSame('PRODUCTO DOS INV  12345', $dos[1], 'description_picking tal cual, sin saltos de línea');
        $this->assertSame('PRODUCTO UNO', $uno[1], 'sin descripción: nombre del producto sin [código]');
        $this->assertSame('<p>Llamar al llegar</p><p>// Portería</p>', $uno[10], 'info: nota del pedido de venta');
        $this->assertSame('2026-11-12 13:30:00', $pedro[8], 'sin pedido: usa la fecha programada del OUT');
        $this->assertSame(['', '', 'Normal'], [$pedro[5], $pedro[7], $pedro[9]]);
    }

    public function test_only_read_methods_are_sent_to_odoo(): void
    {
        app(OdooBatchService::class)->preview('BATCH/00042');

        $calls = Http::recorded(fn(Request $r) => str_contains($r->url(), 'odoo.test'));
        $this->assertNotEmpty($calls);

        foreach ($calls as [$request]) {
            $params = $request['params'];
            if ($params['service'] === 'common') {
                $this->assertSame('authenticate', $params['method']);
                continue;
            }
            $this->assertSame('execute_kw', $params['method']);
            $this->assertContains($params['args'][4], self::READ_METHODS, 'cada llamada a Odoo es de solo lectura');
        }
    }

    public function test_client_refuses_write_methods_before_calling_odoo(): void
    {
        $client = app(\App\Services\OdooClient::class);
        $execute = new \ReflectionMethod($client, 'execute');

        foreach (['write', 'create', 'unlink', 'action_done', 'button_validate'] as $method) {
            try {
                $execute->invoke($client, 'stock.picking', $method, [[10]], []);
                $this->fail("$method debió rechazarse");
            } catch (OdooException $e) {
                $this->assertSame('La conexión con Odoo es solo de consulta.', $e->getMessage());
            }
        }
        Http::assertNothingSent();
    }

    public function test_preview_lists_guides_and_warnings(): void
    {
        $preview = app(OdooBatchService::class)->preview('00042');

        $this->assertSame(2, $preview['guides_count']);
        $this->assertSame(3, $preview['lines_count']);
        $this->assertSame(['WH/OUT/0011', 'S000100'], array_column($preview['guides'], 'guide'));
        $this->assertContains('WH/OUT/0011: sin dirección de entrega.', $preview['warnings']);
        $this->assertContains('WH/OUT/0011: el OUT está en estado En espera.', $preview['warnings']);
        $this->assertArrayNotHasKey('address', $preview['guides'][0], 'la vista previa no expone la dirección completa');
    }

    public function test_unknown_batch_gives_a_readable_error(): void
    {
        $this->expectException(OdooException::class);
        $this->expectExceptionMessage('No se encontró el batch "999" en Odoo.');

        app(OdooBatchService::class)->rows('999');
    }

    public function test_dispatch_from_batch_downloads_the_route_and_logs_the_batch(): void
    {
        $user = User::create(['name' => 'Coordinador', 'email' => 'coord@lfh.test', 'password' => 'secreto-123', 'role' => 'usuario', 'permissions' => ['dashboard.ver', 'dashboard.asignar_ruta']]);
        $messenger = Messenger::create(['name' => 'Mensajero Prueba', 'vehicle' => 'abc12d', 'beetrack_id' => 'prueba', 'is_active' => true]);
        $location = DispatchLocation::create(['name' => 'Principal', 'address' => 'Bodega 1', 'prefix' => 'WH', 'current_consecutive' => 500]);

        $response = $this->actingAs($user)->post(route('dispatch.store'), [
            'odoo_batch' => '00042', 'location_id' => $location->id, 'messenger_id' => $messenger->id, 'output_name' => 'ruta_prueba',
        ], ['Accept' => 'application/json']);

        $response->assertOk();
        $sheet = IOFactory::load($response->baseResponse->getFile()->getPathname())->getActiveSheet()->toArray();

        $this->assertSame('guia', $sheet[0][0]);
        $this->assertSame(['WH/OUT/0011', 'S000100', 'S000100', 'WH500'], array_column(array_slice($sheet, 1), 0), 'guías del batch + guía de retorno');
        $this->assertSame('ABC12D', $sheet[1][1]);
        $this->assertSame('Clínica Demo', $sheet[2][6], 'contacto: primera parte del nombre');
        $this->assertSame('Llamar al llegar// Portería', $sheet[2][16], 'info sin HTML');
        $this->assertSame('Llamar al llegar// Portería', $sheet[3][16], 'info propagada en la misma guía');
        $this->assertSame('', (string) $sheet[1][16], 'la info no pasa a otra guía');
        $this->assertSame('2026/11/12 13:00', $sheet[2][13]);
        $this->assertSame('BATCH/00042', DispatchLog::first()->source_batch);
        $this->assertSame(501, $location->fresh()->current_consecutive);
    }

    public function test_preview_requires_route_assignment_permission(): void
    {
        $user = User::create(['name' => 'Lectura', 'email' => 'lectura@lfh.test', 'password' => 'secreto-123', 'role' => 'usuario', 'permissions' => ['dashboard.ver']]);

        $this->actingAs($user)->getJson(route('dispatch.odoo-preview', ['batch' => '00042']))->assertForbidden();
        Http::assertNothingSent();
    }

    public function test_preview_endpoint_returns_422_for_unknown_batch(): void
    {
        $user = User::create(['name' => 'Coordinador', 'email' => 'coord@lfh.test', 'password' => 'secreto-123', 'role' => 'usuario', 'permissions' => ['dashboard.ver', 'dashboard.asignar_ruta']]);

        $this->actingAs($user)->getJson(route('dispatch.odoo-preview', ['batch' => '999']))
            ->assertStatus(422)
            ->assertJson(['message' => 'No se encontró el batch "999" en Odoo.']);
    }

    // --- Crear la ruta directo en DispatchTrack (importación del rutero) ---

    private function coordinator(array $extra = ['dashboard.crear_ruta_dt']): array
    {
        $user = User::create(['name' => 'Coordinador', 'email' => 'coord@lfh.test', 'password' => 'secreto-123', 'role' => 'usuario', 'permissions' => array_merge(['dashboard.ver', 'dashboard.asignar_ruta'], $extra)]);
        $messenger = Messenger::create(['name' => 'Mensajero Prueba', 'vehicle' => 'abc12d', 'beetrack_id' => 'prueba', 'is_active' => true]);
        $location = DispatchLocation::create(['name' => 'Principal', 'address' => 'Bodega 1', 'prefix' => 'WH', 'current_consecutive' => 500]);
        return [$user, $messenger, $location];
    }

    private function sendRoute(User $user, Messenger $messenger, DispatchLocation $location, array $extra = [])
    {
        return $this->actingAs($user)->postJson(route('dispatch.store'), [
            'odoo_batch' => '00042', 'location_id' => $location->id, 'messenger_id' => $messenger->id,
            'output_name' => 'ruta_prueba', 'send_to_dispatchtrack' => true,
        ] + $extra);
    }

    private function importCalls(): array
    {
        return Http::recorded(fn(Request $r) => str_ends_with(parse_url($r->url(), PHP_URL_PATH), '/import'))->values()->all();
    }

    public function test_sending_is_refused_while_the_switch_is_off(): void
    {
        config(['services.beetrack.create_routes' => false, 'services.beetrack.api_key' => 'token']);
        [$user, $messenger, $location] = $this->coordinator();

        $this->sendRoute($user, $messenger, $location)->assertForbidden();
        $this->assertEmpty($this->importCalls());
        $this->assertSame(0, DispatchLog::count());
    }

    public function test_sending_requires_its_own_permission(): void
    {
        config(['services.beetrack.create_routes' => true, 'services.beetrack.api_key' => 'token']);
        [$user, $messenger, $location] = $this->coordinator([]);

        $this->sendRoute($user, $messenger, $location)
            ->assertForbidden()
            ->assertJson(['message' => 'No tienes permiso para crear rutas en DispatchTrack.']);
        $this->assertEmpty($this->importCalls());
    }

    public function test_sends_the_route_sheet_to_the_import_endpoint(): void
    {
        config(['services.beetrack.create_routes' => true, 'services.beetrack.api_key' => 'token', 'services.beetrack.url' => 'https://lfh.dispatchtrack.test/api/external/v1/routes']);
        [$user, $messenger, $location] = $this->coordinator();

        $response = $this->sendRoute($user, $messenger, $location)->assertOk();

        $calls = $this->importCalls();
        $this->assertCount(1, $calls);
        [$request] = $calls[0];
        $this->assertSame('https://lfh.dispatchtrack.test/api/external/v1/import', $request->url());
        $this->assertSame('token', $request->header('X-AUTH-TOKEN')[0]);
        $parts = collect($request->data())->keyBy('name');
        $this->assertSame(now()->format('d-m-Y'), $parts['date']['contents']);
        $this->assertSame('ruta_prueba.xlsx', $parts['file']['filename']);

        // El archivo enviado es el mismo rutero de la descarga
        $tmp = tempnam(sys_get_temp_dir(), 'dt') . '.xlsx';
        file_put_contents($tmp, $parts['file']['contents']);
        $sheet = IOFactory::load($tmp)->getActiveSheet()->toArray();
        @unlink($tmp);
        $this->assertSame(['WH/OUT/0011', 'S000100', 'S000100', 'WH500'], array_column(array_slice($sheet, 1), 0));

        $log = DispatchLog::find($response->json('log_id'));
        $this->assertSame('queued', $log->dt_status);
        $this->assertSame('ABC12D', $log->dt_truck);
        $this->assertSame(['WH/OUT/0011', 'S000100', 'WH500'], $log->dt_guides);
        $this->assertSame($user->id, $log->user_id);
    }

    public function test_warns_before_sending_guides_already_routed_today(): void
    {
        config(['services.beetrack.create_routes' => true, 'services.beetrack.api_key' => 'token']);
        [$user, $messenger, $location] = $this->coordinator();
        $this->todayRoutes = [['id' => 77, 'truck' => ['identifier' => 'XYZ99A'], 'dispatches' => [['identifier' => 'S000100']]]];

        $this->sendRoute($user, $messenger, $location)
            ->assertStatus(409)
            ->assertJson(['duplicates' => ['Ya están en otra ruta de hoy: S000100.']]);
        $this->assertEmpty($this->importCalls());
        $this->assertSame(500, $location->fresh()->current_consecutive, 'no consume la guía de retorno');

        $this->sendRoute($user, $messenger, $location, ['confirm_duplicates' => true])->assertOk();
        $this->assertCount(1, $this->importCalls());
    }

    public function test_rejected_import_rolls_everything_back(): void
    {
        config(['services.beetrack.create_routes' => true, 'services.beetrack.api_key' => 'token']);
        [$user, $messenger, $location] = $this->coordinator();
        $this->importResponse = ['status' => 'bad_request', 'response' => 'Invalid truck identifier'];

        $this->sendRoute($user, $messenger, $location)
            ->assertStatus(502)
            ->assertJson(['message' => 'DispatchTrack rechazó la ruta: Invalid truck identifier.']);
        $this->assertSame(0, DispatchLog::count());
        $this->assertSame(500, $location->fresh()->current_consecutive);
    }

    public function test_status_confirms_the_route_once_it_appears(): void
    {
        config(['services.beetrack.create_routes' => true, 'services.beetrack.api_key' => 'token']);
        [$user, $messenger, $location] = $this->coordinator();
        $logId = $this->sendRoute($user, $messenger, $location)->json('log_id');

        $this->actingAs($user)->getJson(route('dispatch.dispatchtrack-status', $logId))->assertJson(['status' => 'queued']);

        Cache::flush(); // las rutas del día se guardan un minuto
        $this->todayRoutes = [['id' => 991, 'truck' => ['identifier' => 'ABC-12D'], 'dispatches' => [['identifier' => 'S000100'], ['identifier' => 'WH500']]]];
        $this->actingAs($user)->getJson(route('dispatch.dispatchtrack-status', $logId))
            ->assertJson(['status' => 'created', 'route_id' => '991']);
    }

    public function test_status_gives_up_after_the_wait(): void
    {
        config(['services.beetrack.create_routes' => true, 'services.beetrack.api_key' => 'token']);
        [$user, $messenger, $location] = $this->coordinator();
        $logId = $this->sendRoute($user, $messenger, $location)->json('log_id');

        $this->travel(6)->minutes();
        $this->actingAs($user)->getJson(route('dispatch.dispatchtrack-status', $logId))->assertJson(['status' => 'not_found']);
    }
}
