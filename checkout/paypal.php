<?php

declare(strict_types=1);

function paypalConfig(): array
{
    static $config;

    if ($config === null) {
        $config = require __DIR__ . '/config.php';
    }

    return $config['paypal'];
}

function paypalAssertConfigured(): void
{
    $config = paypalConfig();

    if ($config['client_id'] === '' || $config['client_secret'] === '') {
        throw new RuntimeException(
            'PayPal is not configured. Copy checkout/.env.example to checkout/.env and add credentials.'
        );
    }
}

function paypalApiBaseUrl(): string
{
    $config = paypalConfig();

    return $config['environment'] === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
}

function paypalClientId(): string
{
    paypalAssertConfigured();
    return paypalConfig()['client_id'];
}

function paypalEnvironment(): string
{
    return paypalConfig()['environment'];
}

function paypalCurrency(): string
{
    return paypalConfig()['currency'];
}

function paypalItemName(): string
{
    return paypalConfig()['item_name'];
}

function paypalReturnUrl(): string
{
    return paypalConfig()['return_url'];
}

function paypalCancelUrl(): string
{
    return paypalConfig()['cancel_url'];
}

function paypalAccessToken(): string
{
    paypalAssertConfigured();
    $config = paypalConfig();

    $response = paypalCurlRequest(
        paypalApiBaseUrl() . '/v1/oauth2/token',
        'POST',
        [
            CURLOPT_USERPWD => $config['client_id'] . ':' . $config['client_secret'],
            CURLOPT_POSTFIELDS => 'grant_type=client_credentials',
            CURLOPT_HTTPHEADER => [
                'Accept: application/json',
                'Accept-Language: en_US',
                'Content-Type: application/x-www-form-urlencoded',
            ],
        ]
    );

    if (empty($response['access_token'])) {
        throw new RuntimeException('Could not fetch PayPal access token.');
    }

    return $response['access_token'];
}

function paypalCreateOrder(string $amount, string $currency): array
{
    $accessToken = paypalAccessToken();
    $config = paypalConfig();

    return paypalCurlRequest(
        paypalApiBaseUrl() . '/v2/checkout/orders',
        'POST',
        [
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $accessToken,
                'PayPal-Request-Id: ytfc-' . bin2hex(random_bytes(8)),
            ],
            CURLOPT_POSTFIELDS => json_encode([
                'intent' => 'CAPTURE',
                'purchase_units' => [
                    [
                        'description' => $config['item_name'],
                        'amount' => [
                            'currency_code' => $currency,
                            'value' => $amount,
                        ],
                    ],
                ],
                'application_context' => [
                    'brand_name' => $config['brand_name'],
                    'user_action' => 'PAY_NOW',
                    'shipping_preference' => 'NO_SHIPPING',
                    'return_url' => $config['return_url'],
                    'cancel_url' => $config['cancel_url'],
                ],
            ], JSON_THROW_ON_ERROR),
        ]
    );
}

function paypalCaptureOrder(string $orderId): array
{
    $accessToken = paypalAccessToken();

    return paypalCurlRequest(
        paypalApiBaseUrl() . '/v2/checkout/orders/' . rawurlencode($orderId) . '/capture',
        'POST',
        [
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $accessToken,
            ],
            CURLOPT_POSTFIELDS => '{}',
        ]
    );
}

function paypalCurlRequest(string $url, string $method, array $options = []): array
{
    $curl = curl_init($url);

    $baseOptions = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_TIMEOUT => 30,
    ];

    curl_setopt_array($curl, $baseOptions + $options);

    $rawBody = curl_exec($curl);

    if ($rawBody === false) {
        $error = curl_error($curl);
        curl_close($curl);
        throw new RuntimeException('PayPal request failed: ' . $error);
    }

    $statusCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);

    $decoded = decodeJsonArray($rawBody, 'PayPal returned an invalid response.');

    if ($statusCode < 200 || $statusCode >= 300) {
        $message = !empty($decoded['message'])
            ? $decoded['message']
            : 'Unexpected PayPal API error.';
        throw new RuntimeException($message);
    }

    return $decoded;
}

function jsonInput(): array
{
    $rawBody = file_get_contents('php://input');

    if ($rawBody === false || $rawBody === '') {
        return [];
    }

    return decodeJsonArray($rawBody, 'Invalid JSON body.');
}

function validateAmount(string $amount): string
{
    if (!preg_match('/^\d+(\.\d{1,2})?$/', $amount)) {
        throw new RuntimeException('Amount must be a valid number with up to 2 decimals.');
    }

    $numericAmount = (float) $amount;

    if ($numericAmount < 1 || $numericAmount > 1000) {
        throw new RuntimeException('Amount must be between 1 and 1000.');
    }

    return number_format($numericAmount, 2, '.', '');
}

function jsonResponse(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function decodeJsonArray(string $rawJson, string $errorMessage): array
{
    try {
        $decoded = json_decode($rawJson, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        throw new RuntimeException($errorMessage, 0, $exception);
    }

    if (!is_array($decoded)) {
        throw new RuntimeException($errorMessage);
    }

    return $decoded;
}
