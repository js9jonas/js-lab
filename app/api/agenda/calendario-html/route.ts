// app/api/agenda/calendario-html/route.ts
import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/db"

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
               "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
const DIAS_S = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"]

const CAT: Record<string, { bg: string; text: string; dot: string }> = {
  "Culto":                { bg:"#eff6ff", text:"#1e40af", dot:"#3b82f6" },
  "Reunião":              { bg:"#f0f9ff", text:"#075985", dot:"#0284c7" },
  "Conversa Batismal":    { bg:"#eef2ff", text:"#3730a3", dot:"#6366f1" },
  "Grupo de Louvor":      { bg:"#ecfeff", text:"#155e75", dot:"#06b6d4" },
  "Ensino Confirmatório": { bg:"#f0fdf4", text:"#14532d", dot:"#22c55e" },
  "Plantão Pastoral":     { bg:"#faf5ff", text:"#6b21a8", dot:"#a855f7" },
  "Feriado":              { bg:"#fff1f2", text:"#9f1239", dot:"#f43f5e" },
  "Informativo":          { bg:"#f8fafc", text:"#334155", dot:"#64748b" },
  "Evento Especial":      { bg:"#fffbeb", text:"#92400e", dot:"#f59e0b" },
  "OASE":                 { bg:"#fdf2f8", text:"#9d174d", dot:"#ec4899" },
  "Festa / Kerb":         { bg:"#fff7ed", text:"#9a3412", dot:"#f97316" },
  "Ação de Graças":       { bg:"#f0fdf4", text:"#14532d", dot:"#16a34a" },
  "Férias / Folga":       { bg:"#f1f5f9", text:"#475569", dot:"#94a3b8" },
}

function getDaysInMonth(ano: number, mes: number) {
  return new Date(ano, mes + 1, 0).getDate()
}

function esc(s: string) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")
}

function gerarHTML(mes: number, ano: number, eventos: any[], lema: string): string {
  const nomeMes     = MESES[mes - 1]
  const primeiroDia = new Date(ano, mes - 1, 1).getDay()
  const totalDias   = getDaysInMonth(ano, mes - 1)
  const totalCelulas = Math.ceil((primeiroDia + totalDias) / 7) * 7

  const lemaTexto = lema.replace(/\(([^)]+)\)$/, "").trim()
  const lemaRef   = lema.match(/\(([^)]+)\)$/)?.[0] ?? ""

  const byDay: Record<number, any[]> = {}
  eventos.forEach(ev => {
    const d = new Date(ev.data).getUTCDate()
    if (!byDay[d]) byDay[d] = []
    byDay[d].push(ev)
  })

  const FC = "'Barlow Condensed',sans-serif"

  let celulas = ""
  for (let idx = 0; idx < totalCelulas; idx++) {
    const dayNum = idx - primeiroDia + 1
    const valid  = dayNum >= 1 && dayNum <= totalDias
    const dow    = idx % 7
    const isWk   = dow === 0 || dow === 6
    const evsDia = valid ? (byDay[dayNum] || []) : []

    const bg       = !valid ? "#fbfbfc" : isWk ? "#f9fafb" : "#fff"
    const opacity  = !valid ? "0.2" : "1"
    const numColor = isWk ? "#64748b" : "#0f172a"

    let chips = ""
    evsDia.forEach(ev => {
      const st    = CAT[ev.categoria_nome ?? ""] ?? { bg:"#f8fafc", text:"#334155", dot:"#64748b" }
      const hora  = ev.hora  ? `<span style="font-size:11px;font-weight:700;font-family:${FC};color:${st.text};opacity:.8;line-height:1.2;display:block;letter-spacing:.02em">${esc(ev.hora)}</span>` : ""
      const local = ev.local ? `<span style="font-size:11px;font-family:${FC};color:${st.text};opacity:.65;line-height:1.1;display:block">${esc(ev.local)}</span>` : ""
      chips += `
        <div style="display:flex;align-items:flex-start;gap:4px;padding:3px 6px 3px 4px;border-radius:5px;background:${st.bg};overflow:hidden;margin-bottom:3px">
          <div style="width:4px;height:4px;border-radius:50%;background:${st.dot};flex-shrink:0;margin-top:4px"></div>
          <div style="display:flex;flex-direction:column;min-width:0;width:100%">
            ${hora}
            <span style="font-size:12px;font-weight:600;font-family:${FC};color:${st.text};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.25;letter-spacing:.01em">${esc(ev.titulo)}</span>
            ${local}
          </div>
        </div>`
    })

    celulas += `
      <div style="background:${bg};border-right:1px solid #e8eaed;border-top:1px solid #e8eaed;padding:10px 9px 8px;min-height:120px;display:flex;flex-direction:column;opacity:${opacity}">
        ${valid ? `
          <div style="font-size:28px;font-weight:700;color:${numColor};line-height:1;margin-bottom:8px">${dayNum}</div>
          <div style="flex:1">${chips}</div>
        ` : ""}
      </div>`
  }

  const diasHeader = DIAS_S.map(d =>
    `<div style="padding:9px 12px;text-align:center;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8">${d}</div>`
  ).join("")

  const legenda = Object.entries(CAT).map(([nome, st]) =>
    `<div style="display:flex;align-items:center;gap:5px;font-size:10.5px;color:#475569;font-weight:500">
       <div style="width:8px;height:8px;border-radius:2px;background:${st.dot};flex-shrink:0"></div>${esc(nome)}
     </div>`
  ).join("")

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Calendário ${nomeMes} ${ano}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Barlow+Condensed:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Outfit',-apple-system,sans-serif;background:#eef0f4;padding:16px}
    .toolbar{display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;margin-bottom:16px}
    button{font-family:'Outfit',sans-serif;cursor:pointer}
    #cal{width:100%;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.12)}
    @media print{
      *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      body{background:#fff;padding:0}
      .toolbar{display:none!important}
      #cal{border-radius:0!important;box-shadow:none!important}
      @page{size:A3 landscape;margin:6mm}
    }
  </style>
</head>
<body>
<div class="toolbar">
  <button onclick="history.back()" style="padding:8px 14px;border-radius:8px;border:1px solid #d1d5db;background:#fff;color:#475569;font-size:13px">‹ Voltar</button>
  <span style="font-size:14px;font-weight:600;color:#0f172a;min-width:160px;text-align:center">${nomeMes} ${ano}</span>
  <button onclick="window.print()" style="padding:9px 20px;border-radius:10px;border:none;background:#0f172a;color:#fff;font-size:13px;font-weight:600">⎙ Imprimir / Salvar PDF</button>
</div>

<div id="cal">

  <div style="background:linear-gradient(135deg,#0d1b33 0%,#1a2f57 45%,#0f2240 100%);padding:34px 42px 28px;position:relative;overflow:hidden;display:flex;align-items:flex-end;justify-content:space-between;gap:24px">
    <div style="position:absolute;right:-16px;top:-8px;font-size:118px;font-weight:800;color:rgba(255,255,255,.04);letter-spacing:-3px;line-height:1;white-space:nowrap;pointer-events:none;user-select:none">${nomeMes.toUpperCase()}</div>
    <div style="position:relative;z-index:1">
      <div style="font-size:46px;font-weight:800;color:#fff;letter-spacing:-1.5px;line-height:1;margin-bottom:3px">${nomeMes}</div>
      <div style="font-size:18px;font-weight:300;color:rgba(255,255,255,.45);letter-spacing:5px">${ano}</div>
      <div style="width:36px;height:3px;background:#e6a817;border-radius:2px;margin:13px 0 11px"></div>
      ${lema ? `<div style="font-size:11.5px;color:rgba(255,255,255,.65);max-width:500px;line-height:1.6;font-weight:300;font-style:italic">
        ${esc(lemaTexto)} <span style="color:#e6a817;font-weight:600;font-style:normal">${esc(lemaRef)}</span>
      </div>` : ""}
    </div>
    <div style="position:relative;z-index:1;text-align:right">
      <div style="font-size:11px;font-weight:500;color:rgba(255,255,255,.4);letter-spacing:.1em;text-transform:uppercase;line-height:1.6">Paróquia Martin Luther<br>Cruzeiro do Sul – RS</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(7,1fr);background:#f7f9fc;border-bottom:1px solid #e8eaed">
    ${diasHeader}
  </div>

  <div style="display:grid;grid-template-columns:repeat(7,1fr)">
    ${celulas}
  </div>

  <div style="background:#f7f9fc;border-top:1px solid #e8eaed;padding:12px 42px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">${legenda}</div>
    <div style="font-size:10px;color:#94a3b8">Gerado via JS Lab · Paróquia Martin Luther</div>
  </div>

</div>
</body>
</html>`
}

export async function GET(req: NextRequest) {
  const mes = Number(req.nextUrl.searchParams.get("mes") ?? new Date().getMonth() + 1)
  const ano = Number(req.nextUrl.searchParams.get("ano") ?? new Date().getFullYear())

  const [{ rows: eventos }, { rows: lemas }] = await Promise.all([
    pool.query(
      `SELECT e.titulo, e.data, TO_CHAR(e.hora,'HH24:MI') as hora, e.local,
              c.nome as categoria_nome
       FROM lab.eventos e
       LEFT JOIN lab.evento_categorias c ON c.id = e.id_categoria
       WHERE EXTRACT(MONTH FROM e.data) = $1 AND EXTRACT(YEAR FROM e.data) = $2
       ORDER BY e.data, e.hora NULLS LAST`,
      [mes, ano]
    ),
    pool.query(
      "SELECT lema FROM lab.lemas_mensais WHERE ano = $1 AND mes = $2",
      [ano, mes]
    )
  ])

  const html = gerarHTML(mes, ano, eventos, lemas[0]?.lema ?? "")

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  })
}