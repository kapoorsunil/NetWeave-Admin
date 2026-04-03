import { useEffect, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
const tokenStorageKey = 'netweave_admin_token'
const ADMIN_ROOT_WALLET = '0xB0fAD5d0140529C94D43FDA39e918A23B9E5F555'

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

function formatDateTime(value) {
  if (!value) {
    return '--'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '--'
  }

  return date.toLocaleString()
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
  const [recordSections, setRecordSections] = useState({
    topUpRecords: { totalAmount: 0, totalCount: 0, records: [] },
    adminTopUpRecords: { totalAmount: 0, totalCount: 0, records: [] },
    podPurchases: { totalAmountUsd: 0, totalPodCount: 0, totalCount: 0, records: [] },
    paidRegistrations: { totalCount: 0, records: [] },
    unpaidRegistrations: { totalCount: 0, records: [] },
  })
  const [recordsSearch, setRecordsSearch] = useState({
    topup: '',
    'admin-topup': '',
    'pod-purchase': '',
    'paid-registration': '',
    'unpaid-registration': '',
  })
  const [recordsLoading, setRecordsLoading] = useState({
    topup: false,
    'admin-topup': false,
    'pod-purchase': false,
    'paid-registration': false,
    'unpaid-registration': false,
  })
  const [activeRecordView, setActiveRecordView] = useState(null)
  const [recordsExpanded, setRecordsExpanded] = useState({
    topup: false,
    'admin-topup': false,
    podPurchases: false,
    'paid-registration': false,
    'unpaid-registration': false,
  })

  useEffect(() => {
    if (!token) {
      setAdmin(null)
      setRecordSections({
        topUpRecords: { totalAmount: 0, totalCount: 0, records: [] },
        adminTopUpRecords: { totalAmount: 0, totalCount: 0, records: [] },
        podPurchases: { totalAmountUsd: 0, totalPodCount: 0, totalCount: 0, records: [] },
        paidRegistrations: { totalCount: 0, records: [] },
        unpaidRegistrations: { totalCount: 0, records: [] },
      })
      return
    }

    request('/admin/me', {}, token)
      .then((data) => {
        setAdmin(data)
        if (data.recordSections) {
          setRecordSections(data.recordSections)
        }
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
      if (data.admin?.recordSections) {
        setRecordSections(data.admin.recordSections)
      }
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
    setActiveRecordView(null)
    setRecordSections({
      topUpRecords: { totalAmount: 0, totalCount: 0, records: [] },
      adminTopUpRecords: { totalAmount: 0, totalCount: 0, records: [] },
      podPurchases: { totalAmountUsd: 0, totalPodCount: 0, totalCount: 0, records: [] },
      paidRegistrations: { totalCount: 0, records: [] },
      unpaidRegistrations: { totalCount: 0, records: [] },
    })
    setStatus({ message: 'Logged out.', tone: 'info' })
  }

  const handleRecordsSearch = async (section, explicitWallet = undefined) => {
    const wallet = explicitWallet !== undefined ? explicitWallet : (recordsSearch[section]?.trim() || '')
    setRecordsLoading((current) => ({ ...current, [section]: true }))
    try {
      const params = new URLSearchParams({ section })
      if (wallet) {
        params.set('wallet', wallet)
      }

      const result = await request(`/admin/records?${params.toString()}`, {}, token)
      setRecordSections((current) => ({
        ...current,
        ...(result.topUpRecords ? { topUpRecords: result.topUpRecords } : {}),
        ...(result.adminTopUpRecords ? { adminTopUpRecords: result.adminTopUpRecords } : {}),
        ...(result.podPurchases ? { podPurchases: result.podPurchases } : {}),
        ...(result.paidRegistrations ? { paidRegistrations: result.paidRegistrations } : {}),
        ...(result.unpaidRegistrations ? { unpaidRegistrations: result.unpaidRegistrations } : {}),
      }))
      
      // Kept for backward compatibility if ever needed but detailed view auto-shows the list now
      if (wallet) {
        setRecordsExpanded((current) => ({ ...current, [section]: true }))
      }

      setStatus({
        message: wallet ? 'Record history loaded for the searched wallet.' : 'Full record history loaded successfully.',
        tone: 'success',
      })
    } catch (error) {
      setStatus({ message: error.message || 'Failed to load record history.', tone: 'error' })
    } finally {
      setRecordsLoading((current) => ({ ...current, [section]: false }))
    }
  }

  const handleRecordsInputChange = (section, value) => {
    setRecordsSearch((current) => ({
      ...current,
      [section]: value,
    }))
  }

  const handleOpenRecordView = (section) => {
    setActiveRecordView(section)
    if (recordsSearch[section]) {
      setRecordsSearch((current) => ({ ...current, [section]: '' }))
      handleRecordsSearch(section, '')
    }
  }

  const toggleRecordsSection = (section) => {
    setRecordsExpanded((current) => ({
      ...current,
      [section]: !current[section],
    }))
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
const handleViewAllTree = async () => {
  setIsTreeLoading(true)
  try {
    const data = await request(`/users/team?wallet=${encodeURIComponent(ADMIN_ROOT_WALLET)}`, {}, token)
    setTeamView(data)
    setStatus({ message: 'Complete tree loaded successfully.', tone: 'success' })
  } catch (error) {
    setStatus({ message: error.message || 'Failed to load complete tree.', tone: 'error' })
  } finally {
    setIsTreeLoading(false)
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
          <div className="result-grid">
            <article className="metric-card">
              <span>Total Main Balance</span>
              <strong>${formatMoney(admin.dashboardSummary?.totalMainBalance ?? 0)}</strong>
            </article>
            <article className="metric-card">
              <span>Total Referral Balance</span>
              <strong>${formatMoney(admin.dashboardSummary?.totalReferralBalance ?? 0)}</strong>
            </article>
            <article className="metric-card">
              <span>Total Registration</span>
              <strong>{admin.dashboardSummary?.totalRegistrations ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Paid Registration</span>
              <strong>{admin.dashboardSummary?.paidRegistrations ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Unpaid Registration</span>
              <strong>{admin.dashboardSummary?.unpaidRegistrations ?? 0}</strong>
            </article>
          </div>

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

          <div className="view-tree-row">
            <button className="cta-btn cta-secondary" type="button" onClick={handleViewAllTree} disabled={isTreeLoading}>
              {isTreeLoading ? 'Loading Tree...' : 'View Complete Tree'}
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

        <section className="admin-card records-card">
          {!activeRecordView ? (
            <div className="records-summary-grid">
              <article className="record-summary-card">
                <span className="eyebrow">Top Up Records</span>
                <div className="card-value-group">
                  <h2>${formatMoney(recordSections.topUpRecords?.totalAmount ?? 0)}</h2>
                  <span>Total Amount</span>
                </div>
                <p>• {recordSections.topUpRecords?.totalCount ?? 0} total records</p>
                <button className="cta-btn cta-secondary" type="button" onClick={() => handleOpenRecordView('topup')}>
                  View complete details
                </button>
              </article>
              
              <article className="record-summary-card">
                <span className="eyebrow">Admin Top Up Records</span>
                <div className="card-value-group">
                  <h2>${formatMoney(recordSections.adminTopUpRecords?.totalAmount ?? 0)}</h2>
                  <span>Total Admin Amount</span>
                </div>
                <p>• {recordSections.adminTopUpRecords?.totalCount ?? 0} total records</p>
                <button className="cta-btn cta-secondary" type="button" onClick={() => handleOpenRecordView('admin-topup')}>
                  View complete details
                </button>
              </article>

              <article className="record-summary-card">
                <span className="eyebrow">Pod Purchases</span>
                <div className="card-value-group">
                  <h2>${formatMoney(recordSections.podPurchases?.totalAmountUsd ?? 0)}</h2>
                  <span>Total Purchase Volume</span>
                </div>
                <p>• {recordSections.podPurchases?.totalCount ?? 0} purchases / {recordSections.podPurchases?.totalPodCount ?? 0} pods</p>
                <button className="cta-btn cta-secondary" type="button" onClick={() => handleOpenRecordView('pod-purchase')}>
                  View complete details
                </button>
              </article>

              <article className="record-summary-card">
                <span className="eyebrow">Paid Registrations</span>
                <div className="card-value-group">
                  <h2>{recordSections.paidRegistrations?.totalCount ?? 0}</h2>
                  <span>Total Users</span>
                </div>
                <button className="cta-btn cta-secondary" type="button" onClick={() => handleOpenRecordView('paid-registration')}>
                  View complete details
                </button>
              </article>

              <article className="record-summary-card">
                <span className="eyebrow">Unpaid Registrations</span>
                <div className="card-value-group">
                  <h2>{recordSections.unpaidRegistrations?.totalCount ?? 0}</h2>
                  <span>Total Users</span>
                </div>
                <button className="cta-btn cta-secondary" type="button" onClick={() => handleOpenRecordView('unpaid-registration')}>
                  View complete details
                </button>
              </article>
            </div>
          ) : (
            <>
              {activeRecordView === 'topup' && (
                <div className="records-section">
                  <div className="records-detail-header">
                    <button className="cta-btn cta-secondary" type="button" onClick={() => setActiveRecordView(null)}>Go Back</button>
                  </div>
                  <div className="records-section-header">
                    <div>
                      <span className="eyebrow">Top Up Records</span>
                      <h2>Total Top Up Amount: ${formatMoney(recordSections.topUpRecords?.totalAmount ?? 0)}</h2>
                    </div>
                    <div className="records-header-actions">
                      <span className="records-count">{recordSections.topUpRecords?.totalCount ?? 0} records</span>
                    </div>
                  </div>
                  <div className="search-row">
                    <input
                      className="field-input"
                      type="text"
                      value={recordsSearch.topup}
                      onChange={(event) => handleRecordsInputChange('topup', event.target.value)}
                      placeholder="Search top up records by wallet address"
                    />
                    <button className="cta-btn" type="button" onClick={() => handleRecordsSearch('topup')} disabled={recordsLoading.topup}>
                      {recordsLoading.topup ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                  <div className="records-list">
                    {recordSections.topUpRecords?.records?.length ? (
                      recordSections.topUpRecords.records.map((record) => (
                        <article className="record-item" key={record.id}>
                          <div className="record-item-grid">
                            <div><span>Wallet</span><strong>{record.walletAddress}</strong></div>
                            <div><span>Source</span><strong>{record.source}</strong></div>
                            <div><span>Amount</span><strong>${formatMoney(record.amount)} {record.currency?.toUpperCase?.() || ''}</strong></div>
                            <div><span>Reference</span><strong>{record.referenceId}</strong></div>
                            <div><span>Created At</span><strong>{formatDateTime(record.createdAt)}</strong></div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="empty-records">No top up records found.</div>
                    )}
                  </div>
                </div>
              )}

              {activeRecordView === 'admin-topup' && (
                <div className="records-section">
                  <div className="records-detail-header">
                    <button className="cta-btn cta-secondary" type="button" onClick={() => setActiveRecordView(null)}>Go Back</button>
                  </div>
                  <div className="records-section-header">
                    <div>
                      <span className="eyebrow">Admin Top Up Records</span>
                      <h2>Total Admin Top Up Amount: ${formatMoney(recordSections.adminTopUpRecords?.totalAmount ?? 0)}</h2>
                    </div>
                    <div className="records-header-actions">
                      <span className="records-count">{recordSections.adminTopUpRecords?.totalCount ?? 0} records</span>
                    </div>
                  </div>
                  <div className="search-row">
                    <input
                      className="field-input"
                      type="text"
                      value={recordsSearch['admin-topup']}
                      onChange={(event) => handleRecordsInputChange('admin-topup', event.target.value)}
                      placeholder="Search admin top up records by wallet address"
                    />
                    <button
                      className="cta-btn"
                      type="button"
                      onClick={() => handleRecordsSearch('admin-topup')}
                      disabled={recordsLoading['admin-topup']}
                    >
                      {recordsLoading['admin-topup'] ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                  <div className="records-list">
                    {recordSections.adminTopUpRecords?.records?.length ? (
                      recordSections.adminTopUpRecords.records.map((record) => (
                        <article className="record-item" key={record.id}>
                          <div className="record-item-grid">
                            <div><span>Admin</span><strong>{record.adminEmail}</strong></div>
                            <div><span>Wallet</span><strong>{record.walletAddress}</strong></div>
                            <div><span>Amount</span><strong>${formatMoney(record.amount)}</strong></div>
                            <div><span>Created At</span><strong>{formatDateTime(record.createdAt)}</strong></div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="empty-records">No admin top up records found.</div>
                    )}
                  </div>
                </div>
              )}

              {activeRecordView === 'pod-purchase' && (
                <div className="records-section">
                  <div className="records-detail-header">
                    <button className="cta-btn cta-secondary" type="button" onClick={() => setActiveRecordView(null)}>Go Back</button>
                  </div>
                  <div className="records-section-header">
                    <div>
                      <span className="eyebrow">Pod Purchases</span>
                      <h2>Total Pod Purchase Amount: ${formatMoney(recordSections.podPurchases?.totalAmountUsd ?? 0)}</h2>
                    </div>
                    <div className="records-header-actions">
                      <span className="records-count">
                        {recordSections.podPurchases?.totalCount ?? 0} purchases / {recordSections.podPurchases?.totalPodCount ?? 0} pods
                      </span>
                    </div>
                  </div>
                  <div className="search-row">
                    <input
                      className="field-input"
                      type="text"
                      value={recordsSearch['pod-purchase']}
                      onChange={(event) => handleRecordsInputChange('pod-purchase', event.target.value)}
                      placeholder="Search pod purchases by wallet address"
                    />
                    <button
                      className="cta-btn"
                      type="button"
                      onClick={() => handleRecordsSearch('pod-purchase')}
                      disabled={recordsLoading['pod-purchase']}
                    >
                      {recordsLoading['pod-purchase'] ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                  <div className="records-list">
                    {recordSections.podPurchases?.records?.length ? (
                      recordSections.podPurchases.records.map((record) => (
                        <article className="record-item" key={record.id}>
                          <div className="record-item-grid">
                            <div><span>Wallet</span><strong>{record.walletAddress}</strong></div>
                            <div><span>Cycle / Day</span><strong>Cycle {record.cycleIndex} / Day {record.dayNumber}</strong></div>
                            <div><span>Block / Epoch</span><strong>B{record.blockNumber} / E{record.epochNumber}</strong></div>
                            <div><span>Pod Count</span><strong>{record.podCount}</strong></div>
                            <div><span>Amount</span><strong>${formatMoney(record.amountUsd)}</strong></div>
                            <div><span>Reward</span><strong>+{record.rewardPercentage}% (${formatMoney(record.rewardAmountUsd)})</strong></div>
                            <div><span>Balance Source</span><strong>{record.balanceSource}</strong></div>
                            <div><span>Main Used</span><strong>${formatMoney(record.mainAmountUsd)}</strong></div>
                            <div><span>Referral Used</span><strong>${formatMoney(record.referralAmountUsd)}</strong></div>
                            <div><span>Purchased At</span><strong>{formatDateTime(record.purchasedAt)}</strong></div>
                            <div><span>Claim Date</span><strong>{formatDateTime(record.claimReadyAt)}</strong></div>
                            <div><span>Claim Status</span><strong>{record.isClaimEnabled ? 'Claimable' : `Locked until cycle ${record.unlockCycleIndex}`}</strong></div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="empty-records">No pod purchases found.</div>
                    )}
                  </div>
                </div>
              )}

              {activeRecordView === 'paid-registration' && (
                <div className="records-section">
                  <div className="records-detail-header">
                    <button className="cta-btn cta-secondary" type="button" onClick={() => setActiveRecordView(null)}>Go Back</button>
                  </div>
                  <div className="records-section-header">
                    <div>
                      <span className="eyebrow">Paid Registrations</span>
                      <h2>Total Paid Registrations</h2>
                    </div>
                    <div className="records-header-actions">
                      <span className="records-count">{recordSections.paidRegistrations?.totalCount ?? 0} users</span>
                    </div>
                  </div>
                  <div className="search-row">
                    <input
                      className="field-input"
                      type="text"
                      value={recordsSearch['paid-registration']}
                      onChange={(event) => handleRecordsInputChange('paid-registration', event.target.value)}
                      placeholder="Search paid registrations by wallet address"
                    />
                    <button
                      className="cta-btn"
                      type="button"
                      onClick={() => handleRecordsSearch('paid-registration')}
                      disabled={recordsLoading['paid-registration']}
                    >
                      {recordsLoading['paid-registration'] ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                  <div className="records-list">
                    {recordSections.paidRegistrations?.records?.length ? (
                      recordSections.paidRegistrations.records.map((record) => (
                        <article className="record-item" key={record.id}>
                          <div className="record-item-grid">
                            <div><span>Username</span><strong>{record.username}</strong></div>
                            <div><span>Wallet</span><strong>{record.walletAddress}</strong></div>
                            <div><span>Joined At</span><strong>{formatDateTime(record.createdAt)}</strong></div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="empty-records">No paid registrations found.</div>
                    )}
                  </div>
                </div>
              )}

              {activeRecordView === 'unpaid-registration' && (
                <div className="records-section">
                  <div className="records-detail-header">
                    <button className="cta-btn cta-secondary" type="button" onClick={() => setActiveRecordView(null)}>Go Back</button>
                  </div>
                  <div className="records-section-header">
                    <div>
                      <span className="eyebrow">Unpaid Registrations</span>
                      <h2>Total Unpaid Registrations</h2>
                    </div>
                    <div className="records-header-actions">
                      <span className="records-count">{recordSections.unpaidRegistrations?.totalCount ?? 0} users</span>
                    </div>
                  </div>
                  <div className="search-row">
                    <input
                      className="field-input"
                      type="text"
                      value={recordsSearch['unpaid-registration']}
                      onChange={(event) => handleRecordsInputChange('unpaid-registration', event.target.value)}
                      placeholder="Search unpaid registrations by wallet address"
                    />
                    <button
                      className="cta-btn"
                      type="button"
                      onClick={() => handleRecordsSearch('unpaid-registration')}
                      disabled={recordsLoading['unpaid-registration']}
                    >
                      {recordsLoading['unpaid-registration'] ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                  <div className="records-list">
                    {recordSections.unpaidRegistrations?.records?.length ? (
                      recordSections.unpaidRegistrations.records.map((record) => (
                        <article className="record-item" key={record.id}>
                          <div className="record-item-grid">
                            <div><span>Username</span><strong>{record.username}</strong></div>
                            <div><span>Wallet</span><strong>{record.walletAddress}</strong></div>
                            <div><span>Joined At</span><strong>{formatDateTime(record.createdAt)}</strong></div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="empty-records">No unpaid registrations found.</div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
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




