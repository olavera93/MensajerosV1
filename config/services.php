<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'beetrack' => [
        'api_key' => env('BEETRACK_API_KEY'),
        'url' => env('BEETRACK_URL', 'https://farmaciahom.dispatchtrack.com/api/external/v1/routes'),
        // Minutos sin actividad para las alertas del dashboard
        'alerts' => [
            'idle_minutes' => (int) env('ALERT_IDLE_MINUTES', 45),
            'first_guide_minutes' => (int) env('ALERT_FIRST_GUIDE_MINUTES', 60),
            'return_minutes' => (int) env('ALERT_RETURN_MINUTES', 45),
        ],
    ],

];
