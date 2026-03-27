<?php

declare(strict_types=1);

require __DIR__ . '/paypal.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new RuntimeException('Method not allowed.');
    }

    $input = jsonInput();
    $amount = validateAmount((string) ($input['amount'] ?? ''));
    $currency = (string) ($input['currency'] ?? paypalCurrency());

    if ($currency !== paypalCurrency()) {
        throw new RuntimeException('Unsupported currency.');
    }

    $order = paypalCreateOrder($amount, $currency);

    jsonResponse([
        'id' => $order['id'] ?? null,
        'status' => $order['status'] ?? null,
    ]);
} catch (Throwable $exception) {
    jsonResponse([
        'error' => $exception->getMessage(),
    ], 400);
}
