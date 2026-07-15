<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;

$users = [
    ['email' => 'admin@example.com', 'name' => 'Admin User', 'password' => 'password', 'role' => 'administrador'],
    ['email' => 'dev@example.com', 'name' => 'Developer User', 'password' => 'password', 'role' => 'desarrollador'],
    ['email' => 'lider@example.com', 'name' => 'Lider User', 'password' => 'password', 'role' => 'lider'],
    ['email' => 'regente@example.com', 'name' => 'Regente User', 'password' => 'password', 'role' => 'regente'],
];

foreach ($users as $u) {
    User::updateOrCreate(
        ['email' => $u['email']],
        [
            'name' => $u['name'],
            'password' => Hash::make($u['password']),
            'role' => $u['role']
        ]
    );
    echo "Usuario {$u['email']} creado/actualizado con rol {$u['role']}\n";
}
