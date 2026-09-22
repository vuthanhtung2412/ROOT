/**
 * Dump OpenAPI JSON for client codegen.
 *
 * Run: pnpm --filter @root/web gen:openapi
 * Then: pnpm gen:api-client
 */
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getOpenApiDocument } from '#openapi.ts'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const outputPath = resolve(scriptDirectory, '../openapi.json')

const openApiDocument = getOpenApiDocument()
writeFileSync(outputPath, `${JSON.stringify(openApiDocument, null, 2)}\n`)
console.log(`wrote ${outputPath}`)
