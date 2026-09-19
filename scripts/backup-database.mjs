import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { chmod, copyFile, link, mkdir, realpath, stat, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

function requiredPath(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label}不能为空`)
  }
  return resolve(value.trim())
}

function timestamp(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) {
    throw new Error('备份时间无效')
  }
  const part = (value) => String(value).padStart(2, '0')
  return [
    date.getUTCFullYear(),
    part(date.getUTCMonth() + 1),
    part(date.getUTCDate()),
    '-',
    part(date.getUTCHours()),
    part(date.getUTCMinutes()),
    part(date.getUTCSeconds()),
  ].join('')
}

async function pathExists(path) {
  try {
    await stat(path)
    return true
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return false
    throw error
  }
}

async function hasActiveSqliteSidecar(source) {
  const sidecars = [`${source}-wal`, `${source}-journal`, `${source}-shm`]
  const states = await Promise.all(sidecars.map(pathExists))
  return states.some(Boolean)
}

function sourceUnchanged(before, after) {
  return before.dev === after.dev
    && before.ino === after.ino
    && before.size === after.size
    && before.mtimeNs === after.mtimeNs
    && before.ctimeNs === after.ctimeNs
}

async function removeTemporaryCopy(path) {
  try {
    await unlink(path)
  } catch (error) {
    if (!error || typeof error !== 'object' || error.code !== 'ENOENT') throw error
  }
}

export async function backupDatabase({ sourcePath, backupDirectory, now = new Date() }) {
  const source = requiredPath(sourcePath, '数据库路径')
  const backupRoot = requiredPath(backupDirectory, '备份目录')

  if (source === backupRoot) {
    throw new Error('备份目标不能与正在使用的数据库相同')
  }

  const sourceInfo = await stat(source, { bigint: true })
  if (!sourceInfo.isFile()) throw new Error('数据库路径必须指向文件')

  const canonicalSource = await realpath(source)
  if (await hasActiveSqliteSidecar(canonicalSource)) {
    throw new Error('存在未检查点的 SQLite WAL/journal；请先正常停止服务并完成检查点')
  }

  await mkdir(backupRoot, { recursive: true, mode: 0o700 })
  const canonicalBackupRoot = await realpath(backupRoot)
  await chmod(canonicalBackupRoot, 0o700)
  const backupInfo = await stat(canonicalBackupRoot)
  if (!backupInfo.isDirectory()) throw new Error('备份目录必须指向目录')

  const destination = resolve(
    canonicalBackupRoot,
    `meta-ability-${timestamp(now)}.sqlite`,
  )
  if (canonicalSource === destination) {
    throw new Error('备份目标不能与正在使用的数据库相同')
  }

  const temporary = resolve(canonicalBackupRoot, `.${randomUUID()}.partial`)
  try {
    await copyFile(canonicalSource, temporary, constants.COPYFILE_EXCL)
    await chmod(temporary, 0o600)

    const sourceAfterCopy = await stat(canonicalSource, { bigint: true })
    if (!sourceUnchanged(sourceInfo, sourceAfterCopy) || await hasActiveSqliteSidecar(canonicalSource)) {
      throw new Error('复制期间 SQLite 数据库发生变化；备份已取消')
    }

    await link(temporary, destination)
    await unlink(temporary)
    return destination
  } catch (error) {
    await removeTemporaryCopy(temporary)
    throw error
  }
}

async function main() {
  const destination = await backupDatabase({
    sourcePath: process.env.DATABASE_PATH ?? '',
    backupDirectory: process.env.BACKUP_DIRECTORY ?? './backups',
  })
  console.log(`Database backup created: ${destination}`)
}

const entrypoint = process.argv[1]
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  main().catch((error) => {
    console.error(
      `Database backup failed: ${error instanceof Error ? error.message : '未知错误'}`,
    )
    process.exitCode = 1
  })
}
