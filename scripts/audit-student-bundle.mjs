import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  canonicalAnswers,
  canonicalExplanations,
  assertSafeStudentArtifact,
} from './student-bundle-audit.mjs'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const distributionRoot = join(projectRoot, 'dist')

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [path]
  })
}

const artifactFiles = filesUnder(distributionRoot)
  .filter((path) => /\.(?:css|html|js|json|map|txt)$/i.test(path))
const artifact = artifactFiles.map((path) => readFileSync(path, 'utf8')).join('\n')

assertSafeStudentArtifact(artifact)

const listedFiles = artifactFiles.map((path) => relative(projectRoot, path)).join(', ')
process.stdout.write(`Student bundle audit passed: ${listedFiles}; checked ${canonicalAnswers.length} expected answers and ${canonicalExplanations.length} unique nonempty canonical explanations.\n`)
