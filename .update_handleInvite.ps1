$file = "c:\Users\arios\OneDrive\Documents\Apps\Licor-App-main\src\pages\SettingsPage.jsx"
$content = Get-Content $file -Raw -Encoding UTF8

# Find and replace the handleInvite function
$oldFunction = @'
    const handleInvite = async (e) => {
        e.preventDefault();

        // BLOQUEO DE SEGURIDAD: Solo con licencia activa
        if (!isLicenseActive) {
            showNotification("⚠️ ACCIÓN BLOQUEADA: Debes activar tu suscripción para gestionar empleados.", "error");
            return;
        }

        setInviteStatus('loading');

        try {
            // 1. Validate
            if (!inviteEmail) throw new Error("Email requerido");
'@

$newFunction = @'
    const handleInvite = async (e) => {
        e.preventDefault();

        // BLOQUEO DE SEGURIDAD: Solo con licencia activa
        if (!isLicenseActive) {
            showNotification("⚠️ ACCIÓN BLOQUEADA: Debes activar tu suscripción para gestionar empleados.", "error");
            return;
        }

        setInviteStatus('loading');

        try {
            // 1. Generate unique invitation token
            const inviteToken = crypto.randomUUID();
'@

if ($content -match [regex]::Escape($oldFunction)) {
    Write-Host "Found handleInvite function, updating..."
    
    # Read the file line by line to find the exact function
    $lines = Get-Content $file -Encoding UTF8
    $inFunction = $false
    $functionStart = -1
    $functionEnd = -1
    $braceCount = 0
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^\s*const handleInvite = async \(e\) =>') {
            $functionStart = $i
            $inFunction = $true
            $braceCount = 0
        }
        
        if ($inFunction) {
            # Count braces
            $braceCount += ($lines[$i].ToCharArray() | Where-Object { $_ -eq '{' }).Count
            $braceCount -= ($lines[$i].ToCharArray() | Where-Object { $_ -eq '}' }).Count
            
            if ($braceCount -eq 0 -and $lines[$i] -match '^\s*};') {
                $functionEnd = $i
                break
            }
        }
    }
    
    if ($functionStart -ge 0 -and $functionEnd -ge 0) {
        Write-Host "Function found from line $functionStart to $functionEnd"
        Write-Host "Creating backup..."
        Copy-Item $file "$file.backup" -Force
        
        # Create new function
        $newFunctionLines = @'
    const handleInvite = async (e) => {
        e.preventDefault();

        // BLOQUEO DE SEGURIDAD: Solo con licencia activa
        if (!isLicenseActive) {
            showNotification("⚠️ ACCIÓN BLOQUEADA: Debes activar tu suscripción para gestionar empleados.", "error");
            return;
        }

        setInviteStatus('loading');

        try {
            // 1. Generate unique invitation token
            const inviteToken = crypto.randomUUID();
            
            // 2. Insert generic invitation (no email required)
            const { error: inviteError } = await supabase
                .from('organization_invites')
                .insert([{
                    organization_id: organizationId,
                    role: inviteRole || 'EMPLOYEE',
                    token: inviteToken,
                    status: 'pending',
                    email: null // Generic link - no specific email
                }]);

            if (inviteError) {
                console.error("Error creating invite:", inviteError);
                throw new Error("Error al generar el link de invitación");
            }

            // 3. Generate invitation link
            const inviteLink = `${window.location.origin}/registro-empleado?token=${inviteToken}`;
            
            // 4. Copy to clipboard
            try {
                await navigator.clipboard.writeText(inviteLink);
                showNotification(`✅ Link copiado al portapapeles`, 'success');
            } catch (clipErr) {
                console.warn("Could not copy to clipboard:", clipErr);
            }

            // 5. Show modal with link and copy button
            setGeneratedInviteLink(inviteLink);
            setShowInviteLinkModal(true);
            
            setInviteStatus('success');
            setTimeout(() => setInviteStatus('idle'), 3000);

        } catch (err) {
            console.error(err);
            showNotification(err.message || "Error generando link de invitación", 'error');
            setInviteStatus('error');
        }
    };
'@
        
        # Build new file
        $newLines = @()
        $newLines += $lines[0..($functionStart - 1)]
        $newLines += $newFunctionLines.Split("`n")
        $newLines += $lines[($functionEnd + 1)..($lines.Count - 1)]
        
        # Write new file
        $newLines | Set-Content $file -Encoding UTF8
        Write-Host "✅ handleInvite function updated successfully!"
    }
    else {
        Write-Host "❌ Could not locate function boundaries"
    }
}
else {
    Write-Host "❌ Function pattern not found"
}
