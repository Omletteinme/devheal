import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { runScan } from "./core/scanner.js";
import { runFix } from "./core/fixer.js";

const server = new Server(
  {
    name: "devheal-mcp",
    version: "2.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "devheal_scan",
        description:
          "Scan the local dev environment for missing dependencies, outdated tools, and configuration drift. Returns a precise structural JSON tree mapped directly to the local machine architectures.",
        inputSchema: {
          type: "object",
          properties: {
             cwd: { type: "string", description: "Absolute path to evaluate (defaults to current active directory if not provided)" }
          },
        },
      },
      {
        name: "devheal_fix",
        description:
          "Automatically apply safe algorithmic deterministic healers to fix anomalies discovered in your environment repository locally without using external LLMs.",
        inputSchema: {
          type: "object",
          properties: {
             cwd: { type: "string", description: "Absolute path to evaluate (defaults to current active directory if not provided)" }
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const scanPath = args && typeof args === 'object' && 'cwd' in args && typeof args.cwd === 'string' ? args.cwd : process.cwd();

  try {
     if (name === "devheal_scan") {
         const results = await runScan({ cwd: scanPath });
         return {
             content: [{
                 type: "text",
                 text: JSON.stringify(results, null, 2)
             }]
         };
     } else if (name === "devheal_fix") {
         const results = await runScan({ cwd: scanPath });
         const fixable = results.issues.filter(i => i.fixable);
         if (fixable.length === 0) {
            return { 
                content: [{ 
                    type: "text", 
                    text: "No safe automatic shell/file automated fixes are available for the current environment state right now." 
                }] 
            };
         }
         await runFix(fixable, { cwd: scanPath, dryRun: false, silent: true });
         return {
            content: [{
               type: "text",
               text: `Successfully executed ${fixable.length} deep-system heuristics to stabilize the workspace environment. Re-run devheal_scan to independently verify passing constraints.`
            }]
         };
     } else {
         throw new Error(`Unknown capability execution requested: ${name}`);
     }
  } catch (error: any) {
    return {
      content: [{
         type: "text",
         text: `CRITICAL ERROR Executing DevHeal Module internally -> ${error.message}`
      }],
      isError: true,
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("DevHeal MCP Server established communication channel natively over STDIO layer.");
}

run().catch((e) => {
   console.error("Fatal failure:", e);
   process.exit(1);
});
