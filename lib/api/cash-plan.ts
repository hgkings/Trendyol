export async function getCashPlan() {
    const res = await fetch('/api/user/cash-plan');
    if (!res.ok) throw new Error('Failed to fetch cash plan');
    return res.json();
}

export async function saveCashPlan(data: Record<string, unknown>) {
    const res = await fetch('/api/user/cash-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save cash plan');
    return res.json();
}
