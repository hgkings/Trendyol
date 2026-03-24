export async function getProfile() {
    const res = await fetch('/api/user/profile');
    if (!res.ok) throw new Error('Unauthorized');
    return res.json();
}

export async function updateProfile(data: { full_name?: string }) {
    const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return res.json();
}
