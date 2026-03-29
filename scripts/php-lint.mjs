import { execFileSync } from "node:child_process";

const phpFiles = [
  "checkout/capture-order.php",
  "checkout/config.php",
  "checkout/create-order.php",
  "checkout/index.php",
  "checkout/paypal.php"
];

for (const file of phpFiles) {
  execFileSync("php", ["-l", file], {
    stdio: "inherit"
  });
}
