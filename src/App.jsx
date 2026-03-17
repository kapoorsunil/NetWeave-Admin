import { useEffect, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
const tokenStorageKey = 'netweave_admin_token'

async function request(path, options = {}, token = '') {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  })

  const data = await response.json()

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Request failed.')
  }

  return data.data
}

function formatMoney(value) {
  const numeric = Number(value ?? 0)
  return numeric.toFixed(2)
}

function shortenWallet(value) {
  if (!value) {
    return ''
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function getTreeStats(node) {
  if (!node) {
    return { total: 0, depth: 0, direct: 0 }
  }

  const left = getTreeStats(node.left)
  const right = getTreeStats(node.right)

  return {
    total: 1 + left.total + right.total,
    depth: 1 + Math.max(left.depth, right.depth),
    direct: Number(Boolean(node.left)) + Number(Boolean(node.right)),
  }
}

function AdminTreeNode({ node }) {
  if (!node) {
    return <div className="binary-tree-spacer" aria-hidden="true" />
  }

  const hasChildren = Boolean(node.left || node.right)
  const nodeClassName = [
    'binary-tree-node-card',
    node.isRoot ? 'binary-tree-node-root' : node.isDirectForRoot ? 'binary-tree-node-direct' : 'binary-tree-node-indirect',
  ].join(' ')

  return (
    <div className="binary-tree-node">
      <article className={nodeClassName}>
        <span className="binary-tree-node-name">{node.label || node.username || node.name || 'Anonymous'}</span>
        <span className="binary-tree-node-address">{shortenWallet(node.walletAddress)}</span>
      </article>

      {hasChildren && (
        <div className="binary-tree-children-wrap">
          <div className="binary-tree-child-stem" aria-hidden="true" />
          <div
            className={[
              'binary-tree-children',
              node.left && node.right ? 'binary-tree-children-double' : node.left ? 'binary-tree-children-left-only' : 'binary-tree-children-right-only',
            ].join(' ')}
          >
            <div className={`binary-tree-child-slot binary-tree-child-slot-left ${node.left ? 'binary-tree-child-slot-connected' : ''}`}>
              {node.left ? <AdminTreeNode node={node.left} /> : <div className="binary-tree-spacer" aria-hidden="true" />}
            </div>
            <div className={`binary-tree-child-slot binary-tree-child-slot-right ${node.right ? 'binary-tree-child-slot-connected' : ''}`}>
              {node.right ? <AdminTreeNode node={node.right} /> : <div className="binary-tree-spacer" aria-hidden="true" />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  const [token, setToken] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem(tokenStorageKey) || '' : ''))
  const [admin, setAdmin] = useState(null)
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  })
  const [searchWallet, setSearchWallet] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [status, setStatus] = useState({ message: '', tone: 'info' })
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isTopUping, setIsTopUping] = useState(false)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [teamView, setTeamView] = useState(null)
  const [isTreeLoading, setIsTreeLoading] = useState(false)

  useEffect(() => {
    if (!token) {
      setAdmin(null)
      return
    }

    request('/admin/me', {}, token)
      .then((data) => {
        setAdmin(data)
      })
      .catch(() => {
        localStorage.removeItem(tokenStorageKey)
        setToken('')
        setAdmin(null)
      })
  }, [token])

  const handleLogin = async () => {
    setIsLoggingIn(true)
    try {
      const data = await request('/admin/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      })
      localStorage.setItem(tokenStorageKey, data.token)
      setToken(data.token)
      setAdmin(data.admin)
      setStatus({ message: 'Admin login successful.', tone: 'success' })
    } catch (error) {
      setStatus({ message: error.message || 'Admin login failed.', tone: 'error' })
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(tokenStorageKey)
    setToken('')
    setAdmin(null)
    setSearchResult(null)
    setTopUpAmount('')
    setStatus({ message: 'Logged out.', tone: 'info' })
  }

  const handleSearch = async () => {
    if (!searchWallet.trim()) {
      setStatus({ message: 'Enter a wallet address to search.', tone: 'error' })
      return
    }

    setIsSearching(true)
    try {
      const result = await request(`/admin/users/search?wallet=${encodeURIComponent(searchWallet.trim())}`, {}, token)
      setSearchResult(result)
      setStatus({ message: 'User lookup completed.', tone: 'success' })
    } catch (error) {
      setSearchResult(null)
      setStatus({ message: error.message || 'User search failed.', tone: 'error' })
    } finally {
      setIsSearching(false)
    }
  }

  const handleTopUp = () => {
    if (!searchResult?.walletAddress) {
      setStatus({ message: 'Search for a user wallet first.', tone: 'error' })
      return
    }

    if (!topUpAmount || Number(topUpAmount) <= 0) {
      setStatus({ message: 'Enter a valid top up amount.', tone: 'error' })
      return
    }

    setIsConfirmModalOpen(true)
  }

  const handleConfirmTopUp = async () => {
    setIsTopUping(true)
    try {
      const result = await request(
        '/admin/users/topup',
        {
          method: 'POST',
          body: JSON.stringify({
            walletAddress: searchResult.walletAddress,
            amount: Number(topUpAmount),
          }),
        },
        token,
      )

      setSearchResult((current) => ({
        ...current,
        mainBalance: result.mainBalance,
        totalAdminTopUpSent: result.totalAdminTopUpSent,
      }))
      setAdmin((current) => ({
        ...current,
        balance: result.adminBalance,
      }))
      setTopUpAmount('')
      setIsConfirmModalOpen(false)
      setStatus({ message: 'User top up completed successfully.', tone: 'success' })
    } catch (error) {
      setStatus({ message: error.message || 'Top up failed.', tone: 'error' })
    } finally {
      setIsTopUping(false)
    }
  }

  const handleViewTree = async () => {
    if (!searchResult?.walletAddress) {
      setStatus({ message: 'Search for a user wallet first.', tone: 'error' })
      return
    }

    setIsTreeLoading(true)
    try {
      const data = await request(`/users/team?wallet=${encodeURIComponent(searchResult.walletAddress)}`, {}, token)
      setTeamView(data)
      setStatus({ message: 'Tree loaded successfully.', tone: 'success' })
    } catch (error) {
      setStatus({ message: error.message || 'Failed to load tree.', tone: 'error' })
    } finally {
      setIsTreeLoading(false)
    }
  }

  if (!token || !admin) {
    return (
      <div className="admin-page">
        <div className="admin-login-card">
          <span className="eyebrow">Admin Panel</span>
          <h1>Admin Login</h1>
          <div className="form-grid">
            <label className="field-label">
              <span>Email</span>
              <input
                className="field-input"
                type="email"
                value={loginForm.email}
                onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <label className="field-label">
              <span>Password</span>
              <input
                className="field-input"
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
              />
            </label>
          </div>
          <button className="cta-btn" type="button" onClick={handleLogin} disabled={isLoggingIn}>
            {isLoggingIn ? 'Logging in...' : 'Login'}
          </button>
          {status.message && <div className={`status-card status-${status.tone}`}>{status.message}</div>}
        </div>
      </div>
    )
  }

  if (teamView) {
    const stats = getTreeStats(teamView.tree)

    return (
      <div className="admin-page">
        <div className="admin-shell admin-tree-shell">
          <header className="admin-header">
            <button className="cta-btn cta-secondary" type="button" onClick={() => setTeamView(null)}>
              Go Back
            </button>
            <div className="tree-title-wrap">
              <span className="eyebrow">Admin Tree View</span>
              <h1>{teamView.root?.username || teamView.root?.name || 'User Tree'}</h1>
            </div>
          </header>

          <section className="admin-card">
            <div className="result-grid">
              <article className="metric-card">
                <span>User Wallet</span>
                <strong>{teamView.root?.walletAddress}</strong>
              </article>
              <article className="metric-card">
                <span>Total Team Members</span>
                <strong>{Math.max(stats.total - 1, 0)}</strong>
              </article>
              <article className="metric-card">
                <span>Tree Depth</span>
                <strong>{Math.max(stats.depth - 1, 0)}</strong>
              </article>
            </div>

            <div className="tree-legend">
              <span className="legend-pill root">Root</span>
              <span className="legend-pill direct">Direct</span>
              <span className="legend-pill indirect">Indirect</span>
            </div>

            <div className="binary-tree-shell">
              <div className="binary-tree-canvas">
                <AdminTreeNode node={teamView.tree} />
              </div>
            </div>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-shell">
        <header className="admin-header">
          <div>
            <span className="eyebrow">NetWeave</span>
            <h1>Admin Dashboard</h1>
          </div>
          <div className="admin-header-actions">
            <div className="balance-chip">Admin Balance: ${formatMoney(admin.balance)}</div>
            <button className="cta-btn cta-secondary" type="button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <section className="admin-card">
          <div className="search-row">
            <input
              className="field-input"
              type="text"
              value={searchWallet}
              onChange={(event) => setSearchWallet(event.target.value)}
              placeholder="Enter user wallet address"
            />
            <button className="cta-btn" type="button" onClick={handleSearch} disabled={isSearching}>
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {searchResult && (
            <>
              <div className="result-grid">
                <article className="metric-card">
                  <span>User Wallet</span>
                  <strong>{searchResult.walletAddress}</strong>
                </article>
                <article className="metric-card">
                  <span>User Main Balance</span>
                  <strong>${formatMoney(searchResult.mainBalance)}</strong>
                </article>
                <article className="metric-card">
                  <span>Already Sent To Wallet</span>
                  <strong>${formatMoney(searchResult.totalAdminTopUpSent)}</strong>
                </article>
              </div>

              <div className="topup-row">
                <input
                  className="field-input"
                  type="number"
                  min="0"
                  max="1000"
                  step="0.01"
                  value={topUpAmount}
                  onChange={(event) => setTopUpAmount(event.target.value)}
                  placeholder="Enter top up amount"
                />
                <button className="cta-btn" type="button" onClick={handleTopUp} disabled={isTopUping}>
                  {isTopUping ? 'Sending...' : 'Top Up User'}
                </button>
              </div>
              <div className="view-tree-row">
                <button className="cta-btn cta-secondary" type="button" onClick={handleViewTree} disabled={isTreeLoading}>
                  {isTreeLoading ? 'Loading Tree...' : 'View Tree'}
                </button>
              </div>
              <p className="helper-copy">Admin can send a maximum of $1000 per wallet address.</p>
            </>
          )}

          {status.message && <div className={`status-card status-${status.tone}`}>{status.message}</div>}
        </section>
      </div>

      {isConfirmModalOpen && searchResult && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="confirm-modal">
            <span className="eyebrow">Confirmation</span>
            <h2>Confirm User Top Up</h2>
            <p className="confirm-copy">
              You are about to send <strong>${formatMoney(topUpAmount)}</strong> to{' '}
              <strong>{searchResult.walletAddress}</strong>.
            </p>
            <div className="modal-actions">
              <button
                className="cta-btn cta-secondary"
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isTopUping}
              >
                Cancel
              </button>
              <button className="cta-btn" type="button" onClick={handleConfirmTopUp} disabled={isTopUping}>
                {isTopUping ? 'Sending...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
