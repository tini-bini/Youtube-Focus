<?php

declare(strict_types=1);

require __DIR__ . '/paypal.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new RuntimeException('Method not allowed.');
    }

    $input = jsonInput();
    $orderId = trim((string) ($input['orderID'] ?? ''));

    if ($orderId === '') {
        throw new RuntimeException('Missing order ID.');
    }

    $capture = paypalCaptureOrder($orderId);
    $purchaseUnit = $capture['purchase_units'][0] ?? [];
    $payments = $purchaseUnit['payments']['captures'][0] ?? [];

    jsonResponse([
        'id' => $capture['id'] ?? $orderId,
        'status' => $capture['status'] ?? null,
        'payer' => $capture['payer']['email_address'] ?? null,
        'capture_id' => $payments['id'] ?? null,
        'amount' => $payments['amount']['value'] ?? null,
        'currency' => $payments['amount']['currency_code'] ?? null,
    ]);
} catch (Throwable $exception) {
    jsonResponse([
        'error' => $exception->getMessage(),
    ], 400);
}
