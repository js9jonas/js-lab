export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        /* Neutraliza o layout principal */
        body {
          display: block !important;
          height: auto !important;
          overflow: auto !important;
          background: #888 !important;
        }
        body > aside { display: none !important; }
        body > main {
          overflow: visible !important;
          height: auto !important;
          background: #888 !important;
          padding: 24px !important;
          flex: none !important;
          width: 100% !important;
        }
        @media print {
          body, body > main { background: #fff !important; padding: 0 !important; }
          .rifa-page-gap { margin-bottom: 0 !important; box-shadow: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      {children}
    </>
  )
}
