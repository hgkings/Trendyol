export async function getAnalyses() {
    const res = await fetch('/api/user/analyses');
    if (!res.ok) throw new Error('Failed to fetch analyses');
    return res.json();
}

export async function getAnalysis(id: string) {
    const res = await fetch(`/api/user/analyses?id=${id}`);
    if (!res.ok) throw new Error('Failed to fetch analysis');
    return res.json();
}
