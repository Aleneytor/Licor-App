Write-Host "----------------------------------------"
Write-Host "      SUBIR CAMBIOS A GITHUB"
Write-Host "----------------------------------------"
Write-Host ""
Write-Host "Archivos modificados:"
git status --short
Write-Host ""

$mensaje = Read-Host "Escribe que cambios hiciste (ej. 'Agregue boton salir')"

if ([string]::IsNullOrWhiteSpace($mensaje)) {
    Write-Host "❌ Error: Necesitas escribir un mensaje para continuar."
    exit
}

Write-Host "➡️  Guardando cambios..."
git add .
git commit -m "$mensaje"

Write-Host "⬆️  Subiendo a la nube..."
git push origin main

Write-Host "✅ ¡Listo! Tus cambios estan seguros en GitHub."
