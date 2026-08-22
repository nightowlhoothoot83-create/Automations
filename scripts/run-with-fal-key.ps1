param(
  [Parameter(Mandatory = $true)] [string] $Command,
  [Parameter(ValueFromRemainingArguments = $true)] [string[]] $CommandArguments
)

$secureKey = Read-Host 'Enter temporary fal.ai test key (input is hidden)' -AsSecureString
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $env:FAL_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  & $Command @CommandArguments
  exit $LASTEXITCODE
}
finally {
  Remove-Item Env:FAL_KEY -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
  $secureKey.Dispose()
}
