/** Template dibuat ulang di setiap navigasi → isi halaman masuk dengan animasi. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out fill-mode-both">
      {children}
    </div>
  );
}
