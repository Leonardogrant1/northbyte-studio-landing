import CreatorPostClient from "@/components/creators/CreatorPostClient";

export default async function CreatorPostPage({ params }: { params: Promise<{ creatorId: string }> }) {
    const paramsData = await params;
    return (
        <main className="min-h-screen bg-background text-primary p-6 md:p-12">
            <div className="max-w-4xl mx-auto space-y-8">
                <CreatorPostClient creatorId={paramsData.creatorId} />
            </div>
        </main>
    );
}
