
export default function ChatPage() {
  return (
    <div className="flex flex-1 min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold mb-4">Sorry, Tekir chat services has been shut down temporarily.</h1>
        <p className="text-lg text-muted-foreground mb-6">We appreciate your patience while we work on improvements.</p>
        <a
          href="/"
          className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium shadow transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          ← Go back to Tekir
        </a>
      </div>
    </div>
  );
}

export const metadata = {
  title: "Chat",
  description: "Chat with AI.",
};
