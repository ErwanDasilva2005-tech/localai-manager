import { SignInButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect('/dashboard');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">LocalAI Manager</h1>
      <p className="max-w-md text-sm text-gray-500">
        Gère tes modèles d'IA locaux (Ollama) et connecte-les à tes applications via une passerelle sécurisée.
      </p>
      <SignInButton mode="modal">
        <button className="rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800">
          Se connecter
        </button>
      </SignInButton>
    </main>
  );
}