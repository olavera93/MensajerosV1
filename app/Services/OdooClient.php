<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Cliente de la API externa de Odoo (JSON-RPC), SOLO DE CONSULTA.
 * Únicamente permite métodos de lectura; cualquier otro se rechaza antes de llamar a Odoo.
 */
class OdooClient
{
    /** Métodos de Odoo permitidos. Ninguno crea, modifica ni borra datos. */
    private const READ_METHODS = ['search_read', 'read', 'search_count', 'fields_get'];

    private string $url;
    private ?string $db;
    private ?string $username;
    private ?string $apiKey;

    public function __construct()
    {
        $config = config('services.odoo');
        $this->url = $config['url'] ?? '';
        $this->db = $config['db'] ?? null;
        $this->username = $config['username'] ?? null;
        $this->apiKey = $config['api_key'] ?? null;
    }

    public function configured(): bool
    {
        return $this->url && $this->db && $this->username && $this->apiKey;
    }

    public function searchRead(string $model, array $domain, array $fields, array $options = []): array
    {
        return $this->execute($model, 'search_read', [$domain], ['fields' => $fields] + $options);
    }

    public function read(string $model, array $ids, array $fields): array
    {
        if (empty($ids)) {
            return [];
        }
        return $this->execute($model, 'read', [array_values(array_unique($ids))], ['fields' => $fields]);
    }

    /**
     * De los campos pedidos, solo los que existen en el modelo (varían entre Odoo 17 y 18 y según módulos).
     */
    public function existingFields(string $model, array $wanted): array
    {
        $available = Cache::remember('odoo_fields_' . md5($this->url . $this->db . $model), now()->addDay(), function () use ($model) {
            return array_keys($this->execute($model, 'fields_get', [], ['attributes' => ['type']]));
        });

        return array_values(array_intersect($wanted, $available));
    }

    private function execute(string $model, string $method, array $args, array $kwargs): mixed
    {
        if (!in_array($method, self::READ_METHODS, true)) {
            throw new OdooException('La conexión con Odoo es solo de consulta.');
        }

        return $this->call('object', 'execute_kw', [$this->db, $this->uid(), $this->apiKey, $model, $method, $args, $kwargs]);
    }

    private function uid(): int
    {
        if (!$this->configured()) {
            throw new OdooException('La conexión con Odoo no está configurada. Usa la opción Subir Excel.');
        }

        $key = 'odoo_uid_' . md5($this->url . '|' . $this->db . '|' . $this->username);

        return Cache::remember($key, now()->addHours(12), function () {
            $uid = $this->call('common', 'authenticate', [$this->db, $this->username, $this->apiKey, []]);
            if (!$uid) {
                throw new OdooException('Odoo rechazó las credenciales configuradas.');
            }
            return (int) $uid;
        });
    }

    private function call(string $service, string $method, array $args)
    {
        try {
            $response = Http::timeout(20)->acceptJson()->post($this->url . '/jsonrpc', [
                'jsonrpc' => '2.0',
                'method' => 'call',
                'params' => ['service' => $service, 'method' => $method, 'args' => $args],
                'id' => random_int(1, PHP_INT_MAX),
            ]);
        } catch (ConnectionException $e) {
            Log::warning('Odoo sin respuesta: ' . $e->getMessage());
            throw new OdooException('Odoo no responde en este momento. Intenta de nuevo o usa la opción Subir Excel.');
        }

        if (!$response->successful()) {
            Log::warning('Odoo respondió HTTP ' . $response->status());
            throw new OdooException('Odoo respondió con un error (' . $response->status() . ').');
        }

        if ($error = $response->json('error')) {
            // Solo el mensaje técnico; nunca datos de clientes
            Log::warning('Error de Odoo: ' . ($error['data']['message'] ?? $error['message'] ?? 'desconocido'));
            throw new OdooException('Odoo no pudo responder la consulta: ' . ($error['data']['message'] ?? $error['message'] ?? 'error desconocido') . '.');
        }

        return $response->json('result');
    }
}
