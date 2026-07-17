<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        User::updateOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Admin User',
                'password' => bcrypt('password'),
                'role' => 'administrador',
                'modules' => [
                    'dashboard',
                    'shifts.index',
                    'reports.preoperational',
                    'reports.cleaning',
                    'reports.global-stats',
                    'reports.lunch',
                    'reports.exit',
                    'external-forms.index',
                    'messengers.index',
                    'users.index',
                    'procedures.index'
                ]
            ]
        );

        User::updateOrCreate(
            ['email' => 'lider@example.com'],
            ['name' => 'Lider User', 'password' => bcrypt('password'), 'role' => 'lider']
        );

        User::updateOrCreate(
            ['email' => 'regente@example.com'],
            ['name' => 'Regente User', 'password' => bcrypt('password'), 'role' => 'regente']
        );

        $messengers = [
            ["name" => "Franklinn Ortiz", "vehicle" => "VAS19D", "duration" => 60],
            ["name" => "Francisco Navas", "vehicle" => "QMP51F", "duration" => 60],
            ["name" => "Yordy Alafaro", "vehicle" => "VMQ92F", "duration" => 60],
            ["name" => "Arturo Escandon", "vehicle" => "AQG02G", "duration" => 60],
            ["name" => "Guillermo Mahecha", "vehicle" => "XGU76G", "duration" => 60],
            ["name" => "Daniel Ramos", "vehicle" => "FSA46G", "duration" => 60],
            ["name" => "Carlos Almario", "vehicle" => "ESB55E", "duration" => 60],
            ["name" => "Daniel Yara", "vehicle" => "LTZ36E", "duration" => 60],
            ["name" => "Leonardo Valencia", "vehicle" => "RPE98G", "duration" => 60],
            ["name" => "Julio Escandon", "vehicle" => "WED86E", "duration" => 60],
            ["name" => "Alejandro Gonzalez", "vehicle" => "EHP74F", "duration" => 60],
            ["name" => "John Gonzalez", "vehicle" => "OUP14C", "duration" => 60],
            ["name" => "Esneyder Fernandez", "vehicle" => "AAA26H", "duration" => 60],
            ["name" => "Mauricio Prieto", "vehicle" => "EOK63G", "duration" => 60],
            ["name" => "Michael Perez", "vehicle" => "QJR46F", "duration" => 60],
            ["name" => "Nelson Lopez", "vehicle" => "JMA04G", "duration" => 60],
            ["name" => "Brayan Tocarruncho", "vehicle" => "CUX61G", "duration" => 60],
            ["name" => "Yeison Cuesta", "vehicle" => "RQK23H", "duration" => 60],
            ["name" => "Andres Marquez", "vehicle" => "HID20F", "duration" => 60],
            ["name" => "Jaime Porras", "vehicle" => "VUH99C", "duration" => 60],
            ["name" => "Jairo Contreras", "vehicle" => "FYO88E", "duration" => 60],
            ["name" => "Javier Prieto", "vehicle" => "HUA90E", "duration" => 60],
            ["name" => "David Soto", "vehicle" => "DBV53E", "duration" => 60],
            ["name" => "Jose Calderon", "vehicle" => "FYA04H", "duration" => 60],
            ["name" => "Orlando Ballesteros", "vehicle" => "URP02F", "duration" => 60],
            ["name" => "Yimy Cardenas", "vehicle" => "DCA66H", "duration" => 60],
            ["name" => "German Herrera", "vehicle" => "QSD96G", "duration" => 60],
            ["name" => "Geinson Alvarez", "vehicle" => "ZCO85G", "duration" => 60],
            ["name" => "Juan Castro", "vehicle" => "BC0002", "duration" => 60],
            ["name" => "Juan Lopez", "vehicle" => "JXI73D", "duration" => 60],
            ["name" => "Rodrigo Castro", "vehicle" => "BZF01H", "duration" => 60],
            ["name" => "Yeinny Acevedo", "vehicle" => "P1-30M", "duration" => 30],
            ["name" => "Fernando Santana", "vehicle" => "P2-30M", "duration" => 30]
        ];

        foreach ($messengers as $m) {
            \App\Models\Messenger::firstOrCreate(
                ['name' => $m['name']],
                [
                    'vehicle' => $m['vehicle'],
                    'lunch_duration' => $m['duration']
                ]
            );
        }

        // Seeding Dispatch Locations
        $locations = [
            // Principal (116) -> WH
            [
                'name' => 'Principal',
                'address' => 'CALLE 116 # 15B-26',
                'prefix' => 'WH',
                'current_consecutive' => 100
            ],
            // Teusaquillo -> TE
            [
                'name' => 'Teusaquillo',
                'address' => 'CRA 19 # 39-31',
                'prefix' => 'TE',
                'current_consecutive' => 100
            ],
        ];

        foreach ($locations as $loc) {
            \App\Models\DispatchLocation::firstOrCreate(
                ['name' => $loc['name']],
                [
                    'address' => $loc['address'],
                    'prefix' => $loc['prefix'],
                    'current_consecutive' => $loc['current_consecutive']
                ]
            );
        }
    }
}
