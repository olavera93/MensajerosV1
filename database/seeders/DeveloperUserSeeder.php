<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class DeveloperUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'dev@lafarmacia.com'],
            [
                'name' => 'Desarrollador LFH',
                'password' => Hash::make('dev123'),
                'role' => 'administrador',
            ]
        );
    }
}
