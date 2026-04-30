/**
 * Auth layout — used by /login, /register, /accept-invitation.
 * Clean centered layout with no navigation.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">StoryOS</h1>
          <p className="mt-1 text-sm text-gray-500">Production management platform</p>
        </div>
        {children}
      </div>
    </div>
  );
}
