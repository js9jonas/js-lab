/**
 * Alexa Skill Endpoint — js-lab
 * Rota: POST /api/alexa
 *
 * Fluxo:
 *  1. Alexa envia um AlexaRequest (Launch, Intent, SessionEnded)
 *  2. Identificamos o tipo e extraímos o texto do usuário
 *  3. Para ChatIntent: montamos o histórico, chamamos Claude com ferramentas de BD
 *  4. Claude decide qual consulta SQL executar via tool_use
 *  5. Retornamos a resposta formatada para a Alexa falar
 *
 * Banco: js / schema: public
 * Conexão: pool pg via @/lib/db
 *
 * Estrutura confirmada:
 *  clientes      → id_cliente (PK)
 *  assinaturas   → id_assinatura (PK), id_cliente (FK), venc_contrato, status
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { pool } from "@/lib/db";

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
});

// ─── Tipos do protocolo Alexa ─────────────────────────────────────────────────

interface AlexaRequest {
    version: string;
    session?: {
        sessionId: string;
        new: boolean;
        attributes: Record<string, unknown>;
    };
    request: {
        type: "LaunchRequest" | "IntentRequest" | "SessionEndedRequest";
        intent?: {
            name: string;
            slots?: Record<string, { value?: string }>;
        };
    };
}

interface Message {
    role: "user" | "assistant";
    content: string;
}

// ─── Ferramentas disponíveis para o Claude ────────────────────────────────────

const tools: Anthropic.Tool[] = [
    {
        name: "contar_clientes_por_status",
        description:
            "Conta quantos clientes existem com um determinado status de assinatura. " +
            "Use para perguntas como 'quantos clientes atrasados', 'total de ativos', 'clientes vencidos'.",
        input_schema: {
            type: "object" as const,
            properties: {
                status: {
                    type: "string",
                    enum: ["ativo", "atrasado", "vencido", "inativo", "pendente", "cancelado"],
                    description: "Status da assinatura a filtrar",
                },
            },
            required: ["status"],
        },
    },
    {
        name: "resumo_geral",
        description:
            "Retorna contagem de clientes agrupada por status. " +
            "Use para perguntas gerais como 'me dê um resumo', 'como está o painel', 'status geral'.",
        input_schema: {
            type: "object" as const,
            properties: {},
        },
    },
    {
        name: "vencimentos_proximos",
        description:
            "Lista clientes com assinaturas ativas vencendo nos próximos N dias. " +
            "Use para 'quem vence essa semana', 'vencimentos de hoje', 'próximos vencimentos'.",
        input_schema: {
            type: "object" as const,
            properties: {
                dias: {
                    type: "number",
                    description: "Quantos dias à frente verificar. Padrão: 3. Para 'essa semana' use 7.",
                },
            },
            required: [],
        },
    },
    {
        name: "receita_mes",
        description:
            "Retorna o total de pagamentos recebidos no mês atual e no anterior. " +
            "Use para 'quanto recebi esse mês', 'receita do mês', 'pagamentos recebidos'.",
        input_schema: {
            type: "object" as const,
            properties: {},
        },
    },
];

// ─── Execução das ferramentas (queries no banco js / schema public) ───────────

async function executeTool(
    name: string,
    input: Record<string, unknown>
): Promise<string> {
    try {
        switch (name) {

            case "contar_clientes_por_status": {
                const { status } = input as { status: string };
                const result = await pool.query(
                    `SELECT COUNT(DISTINCT c.id_cliente) AS total
                     FROM clientes c
                     JOIN assinaturas a ON a.id_cliente = c.id_cliente
                     WHERE a.status = $1
                       AND a.id_assinatura = (
                           SELECT id_assinatura FROM assinaturas
                           WHERE id_cliente = c.id_cliente
                           ORDER BY venc_contrato DESC
                           LIMIT 1
                       )`,
                    [status]
                );
                const total = result.rows[0]?.total ?? 0;
                return `Clientes com status '${status}': ${total}`;
            }

            case "resumo_geral": {
                const result = await pool.query(`
                    SELECT
                        a.status,
                        COUNT(DISTINCT c.id_cliente) AS total
                    FROM clientes c
                    JOIN assinaturas a ON a.id_cliente = c.id_cliente
                    WHERE a.id_assinatura = (
                        SELECT id_assinatura FROM assinaturas
                        WHERE id_cliente = c.id_cliente
                        ORDER BY venc_contrato DESC
                        LIMIT 1
                    )
                    GROUP BY a.status
                    ORDER BY total DESC
                `);
                if (!result.rows.length) return "Nenhum dado encontrado no banco.";
                const linhas = result.rows
                    .map((r: { status: string; total: string }) => `${r.status}: ${r.total}`)
                    .join(", ");
                return `Resumo de clientes — ${linhas}`;
            }

            case "vencimentos_proximos": {
                const dias = Number(input.dias) || 3;
                const result = await pool.query(
                    `SELECT c.nome, a.venc_contrato
                     FROM clientes c
                     JOIN assinaturas a ON a.id_cliente = c.id_cliente
                     WHERE a.status = 'ativo'
                       AND a.venc_contrato BETWEEN CURRENT_DATE AND CURRENT_DATE + $1::int
                     ORDER BY a.venc_contrato
                     LIMIT 10`,
                    [dias]
                );
                if (!result.rows.length)
                    return `Nenhum cliente vencendo nos próximos ${dias} dias.`;
                const lista = result.rows
                    .map(
                        (r: { nome: string; venc_contrato: Date }) =>
                            `${r.nome} no dia ${new Date(r.venc_contrato).toLocaleDateString("pt-BR")}`
                    )
                    .join("; ");
                return `Vencendo nos próximos ${dias} dias: ${lista}`;
            }

            case "receita_mes": {
                const result = await pool.query(`
                    SELECT
                        TO_CHAR(DATE_TRUNC('month', data_pgto), 'TMMonth "de" YYYY') AS mes,
                        SUM(valor)::numeric(10,2) AS total
                    FROM pagamentos
                    WHERE data_pgto >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
                    GROUP BY DATE_TRUNC('month', data_pgto)
                    ORDER BY DATE_TRUNC('month', data_pgto) DESC
                `);
                if (!result.rows.length) return "Nenhum pagamento encontrado.";
                const linhas = result.rows
                    .map((r: { mes: string; total: string }) => `${r.mes}: R$ ${r.total}`)
                    .join(" e ");
                return `Receita — ${linhas}`;
            }

            default:
                return "Ferramenta não reconhecida.";
        }
    } catch (err) {
        console.error(`[Alexa Tool Error] ${name}:`, err);
        return "Erro ao consultar o banco de dados.";
    }
}

// ─── Chama o Claude com loop de tool_use ─────────────────────────────────────

async function askClaude(history: Message[], userMessage: string): Promise<string> {
    const messages: Anthropic.MessageParam[] = [
        ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user", content: userMessage },
    ];

    const systemPrompt = `Você é um assistente de voz integrado ao sistema de gestão de clientes IPTV.
Suas respostas serão lidas em voz alta pela Alexa — seja DIRETO e CURTO (máximo 2 frases).
Proibido: markdown, traços, asteriscos, emojis. Use vírgulas para listas.
Se a pergunta envolver dados, use as ferramentas disponíveis antes de responder.
Data de hoje: ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.`;

    let response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        system: systemPrompt,
        tools,
        messages,
    });

    // Loop: Claude pode chamar múltiplas ferramentas antes de dar a resposta final
    while (response.stop_reason === "tool_use") {
        const toolUseBlock = response.content.find(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
        );
        if (!toolUseBlock) break;

        const toolResult = await executeTool(
            toolUseBlock.name,
            toolUseBlock.input as Record<string, unknown>
        );

        messages.push(
            { role: "assistant", content: response.content },
            {
                role: "user",
                content: [
                    {
                        type: "tool_result",
                        tool_use_id: toolUseBlock.id,
                        content: toolResult,
                    },
                ],
            } as Anthropic.MessageParam
        );

        response = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 400,
            system: systemPrompt,
            tools,
            messages,
        });
    }

    const textBlock = response.content.find(
        (b): b is Anthropic.TextBlock => b.type === "text"
    );
    return textBlock?.text ?? "Não consegui processar sua pergunta.";
}

// ─── Helpers de resposta Alexa ────────────────────────────────────────────────

function alexaResponse(
    text: string,
    shouldEndSession: boolean,
    sessionAttributes: Record<string, unknown> = {}
) {
    return NextResponse.json({
        version: "1.0",
        sessionAttributes,
        response: {
            outputSpeech: { type: "PlainText", text },
            reprompt: shouldEndSession
                ? undefined
                : {
                    outputSpeech: {
                        type: "PlainText",
                        text: "Pode perguntar mais alguma coisa sobre o painel.",
                    },
                },
            shouldEndSession,
        },
    });
}

// ─── Handler da rota ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    let body: AlexaRequest;
    try {
        body = await req.json();
    } catch {
        return new NextResponse("Bad Request", { status: 400 });
    }

    const { request, session } = body;
    const attributes = (session?.attributes ?? {}) as { history?: Message[] };
    const history: Message[] = attributes.history ?? [];

    // Skill aberta
    if (request.type === "LaunchRequest") {
        return alexaResponse(
            "Olá! Assistente do painel ativo. Pode perguntar sobre clientes, vencimentos ou receita.",
            false,
            { history: [] }
        );
    }

    // Usuário saiu (explicitamente ou timeout)
    if (request.type === "SessionEndedRequest") {
        return NextResponse.json({ version: "1.0" });
    }

    // Intent recebida
    if (request.type === "IntentRequest") {
        const intentName = request.intent?.name;

        if (intentName === "AMAZON.StopIntent" || intentName === "AMAZON.CancelIntent") {
            return alexaResponse("Até logo!", true);
        }

        if (intentName === "AMAZON.HelpIntent") {
            return alexaResponse(
                "Você pode perguntar: quantos clientes ativos, resumo geral, " +
                "quem vence essa semana, ou quanto recebi esse mês.",
                false,
                { history }
            );
        }

        if (intentName === "ChatIntent") {
            const userText = request.intent?.slots?.query?.value;

            if (!userText) {
                return alexaResponse("Não entendi. Pode repetir?", false, { history });
            }

            try {
                const answer = await askClaude(history, userText);

                // Mantém no máximo 20 mensagens no histórico (10 trocas)
                const updatedHistory: Message[] = [
                    ...history,
                    { role: "user" as const, content: userText },
                    { role: "assistant" as const, content: answer },
                ].slice(-20);

                return alexaResponse(answer, false, { history: updatedHistory });
            } catch (err) {
                console.error("[Alexa Claude Error]", err);
                return alexaResponse("Tive um problema. Tente de novo.", false, { history });
            }
        }

        return alexaResponse(
            "Não reconheci esse comando. Pergunte sobre clientes ou receita.",
            false,
            { history }
        );
    }

    return new NextResponse("Unhandled", { status: 400 });
}