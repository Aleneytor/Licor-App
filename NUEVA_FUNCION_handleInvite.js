// ====================================================================
// INSTRUCCIONES: Reemplazar la función handleInvite completa
// ====================================================================
// Busca la línea ~1008 que dice: const handleInvite = async (e) => {
// Selecciona TODA la función hasta el }; que la cierra (línea ~1085)
// Bórrala completamente y reemplázala con esto:

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
