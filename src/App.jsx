import { useState, useEffect, useCallback, useRef } from 'react'
import cloudbase from '@cloudbase/js-sdk'
import './App.css'

// PG 模式环境
const ENV_ID = 'test-pg-d3gf5tl148895663c'
const BUCKET_ID = 'test3'

const app = cloudbase.init({
  env: ENV_ID,
  accessKey: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjYxYTQzYTI3LWIxOTQtNDY4MC04NTg5LWZjMGZlZmQxYmM1MCJ9.eyJpc3MiOiJodHRwczovL3Rlc3QtcGctZDNnZjV0bDE0ODg5NTY2M2MuYXAtc2hhbmdoYWkudGNiLWFwaS50ZW5jZW50Y2xvdWRhcGkuY29tIiwic3ViIjoiYW5vbiIsImF1ZCI6InRlc3QtcGctZDNnZjV0bDE0ODg5NTY2M2MiLCJleHAiOjQwODc4NTgwOTIsImlhdCI6MTc4NDE3NDg5Miwibm9uY2UiOiI1c1RBZVB6OVFFeUJxenFmVFZ0VkF3IiwiYXRfaGFzaCI6IjVzVEFlUHo5UUV5QnF6cWZUVnRWQXciLCJuYW1lIjoiQW5vbnltb3VzIiwic2NvcGUiOiJhbm9ueW1vdXMiLCJwcm9qZWN0X2lkIjoidGVzdC1wZy1kM2dmNXRsMTQ4ODk1NjYzYyIsIm1ldGEiOnsicGxhdGZvcm0iOiJQdWJsaXNoYWJsZUtleSJ9LCJyb2xlIjoiYW5vbiIsImlzX2Fub255bW91cyI6dHJ1ZSwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiYW5vbnltb3VzIiwicHJvdmlkZXJzIjpbImFub255bW91cyJdfSwidXNlcl9tZXRhZGF0YSI6eyJuYW1lIjoiQW5vbnltb3VzIn0sInVzZXJfdHlwZSI6IiIsImNsaWVudF90eXBlIjoiY2xpZW50X3VzZXIiLCJpc19zeXN0ZW1fYWRtaW4iOmZhbHNlfQ.H0xBYSjW0QAsJsQ6t-eJSC2u6496FKzNqaXMdQcfdjgPN4eMu7azMo2wvXzvYHK-QJ1siOgThRvDNVIyfNJpsgQd3Eqip9sDBKmyxT4olBLedGTvVZgFNRvTr347fVCSZErzCgV9x7r40Bh59WLMxegbVSB-SNiO9Fnuz6j8wVxnrrCKLc1n_x6YJtgevM-WeGRDbYsvjqMJlntwjVnstDWbOUkdEctB_D10VmEaTsLdv6oarAuHe50JUX30LHhPdTHI-mrbrDLI2Y3Syvnp_M5EZ_jw5Fce3bcaRHmeqj18ongwaTPzgUtIKlaedhpgu5O9SHjQLjzyJtws19gToA'
})

function getFileType(name) {
  const ext = name.split('.').pop().toLowerCase()
  if (['jpg','jpeg','png','gif','svg','webp','bmp','ico'].includes(ext)) return 'img'
  if (['doc','docx','xls','xlsx','ppt','pptx','txt','md'].includes(ext)) return 'doc'
  if (['pdf'].includes(ext)) return 'pdf'
  if (['js','ts','jsx','tsx','html','css','json','xml','yaml','yml','py','java','go'].includes(ext)) return 'code'
  if (['mp4','webm','mov','avi','mkv'].includes(ext)) return 'video'
  return 'other'
}

const ICONS = { img: '🖼️', doc: '📄', pdf: '📕', code: '💻', video: '🎬', other: '📁' }

function formatSize(bytes) {
  if (!bytes) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0, s = bytes
  while (s >= 1024 && i < units.length - 1) { s /= 1024; i++ }
  return s.toFixed(i === 0 ? 0 : 1) + ' ' + units[i]
}

function formatDate(ts) {
  if (!ts) return '-'
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function App() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('loading')
  const [view, setView] = useState('grid')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, name: '' })
  const [preview, setPreview] = useState(null)
  const [toast, setToast] = useState(null)
  const fileInputRef = useRef(null)
  const dropRef = useRef(null)

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const init = useCallback(async () => {
    try {
      // Publishable Key 已内置鉴权
      setStatus('connected')
      const { data } = await app.storage.listBuckets()
      console.log('已存在的 Bucket:', data)
      if (data && data.length > 0 && !data.find(b => b.name === BUCKET_ID)) {
        console.log(`Bucket "${BUCKET_ID}" 不存在`)
        console.log('可选 Bucket 名称:', data.map(b => b.name).join(', '))
      }
    } catch (err) {
      console.error('初始化失败:', err)
      setStatus('error')
    }
  }, [])

  // PG 模式：list() 可用！返回 objects 数组
  const loadFiles = useCallback(async () => {
    try {
      const { data, error } = await app.storage.from(BUCKET_ID).list()
      if (error) throw error

      const objects = data?.objects || []
      const list = objects.map(obj => {
        const { data: urlData } = app.storage.from(BUCKET_ID).getPublicUrl(obj.name)
        return {
          ...obj,
          publicUrl: urlData?.publicUrl || '',
          type: getFileType(obj.name)
        }
      })
      setFiles(list)
    } catch (err) {
      console.error('加载失败:', err)
      showToast('加载文件列表失败: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    init().then(() => loadFiles())
  }, [init, loadFiles])

  const handleUpload = async (fileList) => {
    const list = Array.from(fileList)
    if (!list.length) return
    setUploading(true)
    let ok = 0, fail = 0

    for (let i = 0; i < list.length; i++) {
      const file = list[i]
      setProgress({ current: i + 1, total: list.length, name: file.name })
      try {
        console.log(`尝试上传到 Bucket: ${BUCKET_ID}, file: ${file.name}`)
        // PG 模式：upload(path, file, options)，upsert 默认 false
        const { data, error } = await app.storage.from(BUCKET_ID).upload(file.name, file, {
          cacheControl: 'max-age=3600',
          upsert: true  // 覆盖同名文件
        })
        console.log('upload 返回:', { data, error })
        if (error) throw error
        ok++
      } catch (err) {
        console.error(`上传 ${file.name} 失败:`, err)
        console.error('完整错误对象:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2))
        fail++
      }
    }

    setUploading(false)
    setProgress({ current: 0, total: 0, name: '' })
    if (ok > 0) { showToast(`成功上传 ${ok} 个文件`); loadFiles() }
    if (fail > 0) showToast(`${fail} 个文件上传失败`, 'error')
  }

  // PG 模式：remove(paths)，参数是 bucket 内路径
  const handleDelete = async (name) => {
    if (!confirm(`确定要删除 "${name}" 吗？此操作不可撤销。`)) return
    try {
      const { data, error } = await app.storage.from(BUCKET_ID).remove([name])
      if (error) throw error
      // 必须校验 data：RLS 拒绝时，error 为 null 但 data 为空数组
      if (!data || data.length === 0) {
        throw new Error('删除失败：文件不存在或没有删除权限（请检查 RLS Policy）')
      }
      showToast(`已删除 "${name}"`)
      loadFiles()
    } catch (err) {
      showToast('删除失败: ' + err.message, 'error')
    }
  }

  // PG 模式：createSignedUrl(path, ttl, options)
  const handlePreview = async (name, type) => {
    try {
      if (type === 'img') {
        const { data } = await app.storage.from(BUCKET_ID).createSignedUrl(name, 3600)
        if (data?.fullSignedURL) setPreview(data.fullSignedURL)
      } else {
        const { data } = await app.storage.from(BUCKET_ID).createSignedUrl(name, 3600, { download: name })
        if (data?.fullSignedURL) window.open(data.fullSignedURL, '_blank')
      }
    } catch (err) {
      showToast('获取文件链接失败', 'error')
    }
  }

  const handleDownload = async (name) => {
    try {
      const { data } = await app.storage.from(BUCKET_ID).createSignedUrl(name, 3600, { download: name })
      if (data?.fullSignedURL) {
        const a = document.createElement('a')
        a.href = data.fullSignedURL
        a.download = name
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
    } catch (err) {
      showToast('下载失败', 'error')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    dropRef.current?.classList.remove('dragover')
    if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files)
  }

  return (
    <div className="container">
      <div className="header">
        <h1>文件管理器</h1>
        <p>上传、管理和分享你的文件 · CloudBase PG 模式</p>
      </div>

      <div className="status-bar">
        <span className={`status-dot ${status}`} />
        <span>{status === 'loading' ? '连接中...' : status === 'connected' ? 'CloudBase PG 已连接' : '连接失败'}</span>
      </div>

      {/* 上传区域 */}
      <div
        ref={dropRef}
        className="upload-zone"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); dropRef.current?.classList.add('dragover') }}
        onDragLeave={() => dropRef.current?.classList.remove('dragover')}
        onDrop={handleDrop}
      >
        <div className="upload-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <h3>点击或拖拽文件上传</h3>
        <p>支持图片、文档、视频等任意文件类型</p>
        <input ref={fileInputRef} type="file" multiple hidden onChange={e => { handleUpload(e.target.files); e.target.value = '' }} />
      </div>

      {/* 进度条 */}
      {uploading && (
        <div className="progress-bar active">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
          </div>
          <div className="progress-text">上传中 ({progress.current}/{progress.total}): {progress.name}</div>
        </div>
      )}

      {/* 工具栏 */}
      <div className="toolbar">
        <h2>我的文件 ({files.length})</h2>
        <div className="toolbar-actions">
          <div className="view-toggle">
            <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
            </button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
              </svg>
            </button>
          </div>
          <button className="btn" onClick={loadFiles}>🔄 刷新</button>
          <button className="btn" onClick={async () => {
            try {
              const { data, error } = await app.storage.createBucket('sdk-test', {
                public: true,
                type: 'STANDARD',
                fileSizeLimit: '50MB'
              })
              if (error) throw error
              console.log('Bucket 创建成功:', data)
              showToast('Bucket "sdk-test" 创建成功')
            } catch (err) {
              console.error('创建失败:', err)
              showToast('创建失败: ' + err.message, 'error')
            }
          }}>+ 创建 Bucket</button>
        </div>
      </div>

      {/* 文件列表 */}
      {loading ? (
        <div className="empty-state"><p>加载中...</p></div>
      ) : files.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" width="80" height="80">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
            <polyline points="13 2 13 9 20 9"/>
          </svg>
          <p>还没有文件，点击上方区域上传</p>
        </div>
      ) : view === 'grid' ? (
        <div className="file-grid">
          {files.map(f => (
            <div key={f.name} className="file-card" onClick={() => handlePreview(f.name, f.type)}>
              <div className="file-card-preview">
                {f.type === 'img' && f.publicUrl ? (
                  <img src={f.publicUrl} alt={f.name} loading="lazy" />
                ) : ICONS[f.type]}
              </div>
              <div className="file-card-info">
                <div className="file-card-name" title={f.name}>{f.name}</div>
                <div className="file-card-meta">
                  <span>{formatSize(f.metadata?.size)}</span>
                  <span>{formatDate(f.created_at)}</span>
                </div>
              </div>
              <div className="file-card-actions">
                <button className="btn" onClick={e => { e.stopPropagation(); handleDownload(f.name) }}>⬇ 下载</button>
                <button className="btn btn-danger" onClick={e => { e.stopPropagation(); handleDelete(f.name) }}>🗑 删除</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="file-list">
          <div className="file-list-header">
            <span>文件名</span><span>大小</span><span>日期</span><span>操作</span>
          </div>
          {files.map(f => (
            <div key={f.name} className="file-item">
              <div className="file-name">
                <div className={`file-icon-s ${f.type}`}>{ICONS[f.type]}</div>
                <span onClick={() => handlePreview(f.name, f.type)}>{f.name}</span>
              </div>
              <div className="file-size">{formatSize(f.metadata?.size)}</div>
              <div className="file-date">{formatDate(f.created_at)}</div>
              <div className="file-actions">
                <button className="btn" onClick={() => handleDownload(f.name)}>⬇</button>
                <button className="btn btn-danger" onClick={() => handleDelete(f.name)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 图片预览 */}
      {preview && (
        <div className="modal-overlay active" onClick={() => setPreview(null)}>
          <button className="modal-close" onClick={() => setPreview(null)}>×</button>
          <img src={preview} alt="预览" />
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
