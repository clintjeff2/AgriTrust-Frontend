# Fix BigInt literals in test files
$files = @(
    "__tests__\usePreflightSimulation.test.tsx",
    "__tests__\TransactionModal.test.tsx",
    "__tests__\escrowDepositIntegration.test.tsx"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $content = $content -replace '(\d+)n([,\s\)])', 'BigInt($1)$2'
        Set-Content $file $content
        Write-Host "Fixed $file"
    }
}
