<?php

declare(strict_types=1);

$envFile = __DIR__ . '/.env';
$env = [];

if (is_file($envFile)) {
    $parsed = parse_ini_file($envFile, false, INI_SCANNER_TYPED);

    if (is_array($parsed)) {
        $env = $parsed;
    }
}

$checkoutBaseUrl = rtrim((string) ($env['CHECKOUT_BASE_URL'] ?? 'http://127.0.0.1:8080/checkout'), '/');

return [
    'paypal' => [
        'environment' => (string) ($env['PAYPAL_ENVIRONMENT'] ?? 'sandbox'),
        'client_id' => (string) ($env['PAYPAL_CLIENT_ID'] ?? ''),
        'client_secret' => (string) ($env['PAYPAL_CLIENT_SECRET'] ?? ''),
        'currency' => (string) ($env['PAYPAL_CURRENCY'] ?? 'EUR'),
        'brand_name' => (string) ($env['PAYPAL_BRAND_NAME'] ?? 'FlegarTech'),
        'item_name' => (string) ($env['PAYPAL_ITEM_NAME'] ?? 'Support YouTube Focus Clean'),
        'return_url' => $checkoutBaseUrl . '/',
        'cancel_url' => $checkoutBaseUrl . '/',
    ],
];
