// ══════════════════════════════════════════════════════
// MESSAGES PAGE — inbox + conversation threads
// ══════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react'
import { Avatar, Button } from '../components/UI'
import PlayerName from '../components/PlayerName'
import styles from './Messages.module.css'

const API = import.meta.env.VITE_API_URL || ''
const token = () => localStorage.getItem('gambit_token')

function InboxRow({ conv, isActive, onClick }) {
  const date = conv.last_at
    ? new Date(conv.last_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : ''
  return (
    <div
      className={`${styles.inboxRow} ${isActive ? styles.inboxRowActive : ''} ${conv.unread_count > 0 ? styles.inboxRowUnread : ''}`}
      onClick={onClick}
    >
      <Avatar username={conv.username} size={40} />
      <div className={styles.inboxInfo}>
        <div className={styles.inboxName}>
          <PlayerName username={conv.username} title={conv.fide_title || conv.platform_title} size="sm" />
          {conv.unread_count > 0 && (
            <span className={styles.unreadDot}>{conv.unread_count}</span>
          )}
        </div>
        <div className={styles.inboxPreview}>{conv.last_message || '—'}</div>
      </div>
      <div className={styles.inboxDate}>{date}</div>
    </div>
  )
}

function MessageBubble({ msg, isMine }) {
  const time = new Date(msg.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleTheirs}`}>
      <div className={styles.bubbleText}>{msg.content}</div>
      <div className={styles.bubbleTime}>{time}</div>
    </div>
  )
}

export function MessagesPage({ user, onOpenAuth, initialUsername }) {
  const [inbox, setInbox]           = useState([])
  const [activeUsername, setActiveUsername] = useState(initialUsername || null)
  const [thread, setThread]         = useState([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [inboxLoading, setInboxLoading]   = useState(true)
  const [draft, setDraft]           = useState('')
  const [sending, setSending]       = useState(false)
  const bottomRef = useRef(null)

  // Fetch inbox
  const fetchInbox = useCallback(() => {
    if (!user) return
    fetch(`${API}/api/messages`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(data => setInbox(Array.isArray(data.conversations) ? data.conversations : []))
      .catch(() => {})
      .finally(() => setInboxLoading(false))
  }, [user])

  useEffect(() => { fetchInbox() }, [fetchInbox])

  // Fetch thread when activeUsername changes
  useEffect(() => {
    if (!activeUsername || !user) return
    setThreadLoading(true)
    fetch(`${API}/api/messages/${activeUsername}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(data => {
        setThread(Array.isArray(data.messages) ? data.messages : [])
        // Mark as read
        fetch(`${API}/api/messages/${activeUsername}/read`, {
          method: 'PUT', headers: { Authorization: `Bearer ${token()}` },
        }).then(fetchInbox)
      })
      .catch(() => {})
      .finally(() => setThreadLoading(false))
  }, [activeUsername, user, fetchInbox])

  // Scroll to bottom when thread updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread])

  async function sendMessage() {
    if (!draft.trim() || !activeUsername) return
    setSending(true)
    try {
      const res = await fetch(`${API}/api/messages/${activeUsername}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ content: draft.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setThread(t => [...t, data.message || data])
        setDraft('')
        fetchInbox()
      }
    } finally { setSending(false) }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  if (!user) return (
    <div className={styles.gate}>
      <div className={styles.gateIcon}>✉️</div>
      <h2>Sign in to view messages</h2>
      <Button variant="primary" onClick={() => onOpenAuth('login')}>Log In</Button>
    </div>
  )

  const activeConv = inbox.find(c => c.username === activeUsername)

  return (
    <div className={styles.page}>
      <div className={styles.layout}>

        {/* Inbox sidebar */}
        <div className={styles.inbox}>
          <div className={styles.inboxHeader}>
            <span className={styles.inboxTitle}>Messages</span>
          </div>
          {inboxLoading ? (
            <div className={styles.state}>Loading…</div>
          ) : inbox.length === 0 ? (
            <div className={styles.inboxEmpty}>No conversations yet.</div>
          ) : (
            inbox.map(c => (
              <InboxRow
                key={c.username}
                conv={c}
                isActive={c.username === activeUsername}
                onClick={() => setActiveUsername(c.username)}
              />
            ))
          )}
        </div>

        {/* Thread */}
        <div className={styles.thread}>
          {!activeUsername ? (
            <div className={styles.threadEmpty}>
              <div className={styles.threadEmptyIcon}>✉️</div>
              <p>Select a conversation to read messages.</p>
            </div>
          ) : (
            <>
              <div className={styles.threadHeader}>
                <Avatar username={activeUsername} size={32} />
                <PlayerName
                  username={activeUsername}
                  title={activeConv?.fide_title || activeConv?.platform_title}
                  size="md"
                />
              </div>

              <div className={styles.threadMessages}>
                {threadLoading ? (
                  <div className={styles.state}>Loading…</div>
                ) : thread.length === 0 ? (
                  <div className={styles.threadEmpty}>
                    <p>Start the conversation!</p>
                  </div>
                ) : (
                  thread.map(msg => (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      isMine={msg.sender_id === user.id || msg.sender_username === user.username}
                    />
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              <div className={styles.composer}>
                <textarea
                  className={styles.composerInput}
                  placeholder="Write a message… (Enter to send)"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                />
                <Button variant="primary" onClick={sendMessage} disabled={!draft.trim() || sending}>
                  {sending ? '…' : 'Send'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
