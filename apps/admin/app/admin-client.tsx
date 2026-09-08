'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const sections = [
  ['ads', 'Объявления'],
  ['reports', 'Жалобы'],
  ['users', 'Пользователи'],
  ['categories', 'Категории'],
  ['moderation-terms', 'Термины'],
] as const;
type SectionId = (typeof sections)[number][0];
type Item = Record<string, unknown> & { id: string };

async function api(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? 'Не удалось выполнить запрос.');
  return data;
}

function text(item: Item, key: string) {
  const value = item[key];
  if (value == null) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function AdminPage({ section }: { section: SectionId }) {
  const [token, setToken] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => setToken(sessionStorage.getItem('doska_admin_token') ?? ''), []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await api(`/admin/${section}`, token);
      setItems(data.items ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ошибка загрузки.');
    } finally {
      setLoading(false);
    }
  }, [section, token]);

  useEffect(() => void load(), [load]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? 'Не удалось войти.');
      await api('/admin/me', data.accessToken);
      sessionStorage.setItem('doska_admin_token', data.accessToken);
      setToken(data.accessToken);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ошибка входа.');
    }
  }

  async function act(item: Item, action: string, body: object) {
    try {
      const path =
        action === 'edit'
          ? `/admin/${section}/${item.id}`
          : `/admin/${section}/${item.id}/${action}`;
      await api(path, token, {
        method: action === 'edit' ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ошибка действия.');
    }
  }

  if (!token) {
    return (
      <main className="login">
        <form className="panel" onSubmit={login}>
          <p className="eyebrow">DOSKA</p>
          <h1>Вход для команды</h1>
          <p>Доступ проверяется отдельно от обычного аккаунта.</p>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Пароль
            <input name="password" type="password" required />
          </label>
          {error && <p className="error">{error}</p>}
          <button>Войти</button>
        </form>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside>
        <div>
          <p className="eyebrow">DOSKA</p>
          <h2>Модерация</h2>
        </div>
        <nav>
          {sections.map(([id, label]) => (
            <a className={id === section ? 'active' : ''} href={`/${id}`} key={id}>
              {label}
            </a>
          ))}
        </nav>
        <button
          className="quiet"
          onClick={() => {
            sessionStorage.removeItem('doska_admin_token');
            setToken('');
          }}
        >
          Выйти
        </button>
      </aside>
      <main>
        <header>
          <div>
            <p className="eyebrow">РАБОЧАЯ ОЧЕРЕДЬ</p>
            <h1>{sections.find(([id]) => id === section)?.[1]}</h1>
          </div>
          <button className="secondary" onClick={() => void load()}>
            Обновить
          </button>
        </header>
        {error && <p className="error">{error}</p>}
        {loading ? (
          <p>Загрузка…</p>
        ) : (
          <ItemList
            section={section}
            items={items}
            act={act}
            token={token}
            reload={load}
            setError={setError}
          />
        )}
      </main>
    </div>
  );
}

function ItemList({
  section,
  items,
  act,
  token,
  reload,
  setError,
}: {
  section: SectionId;
  items: Item[];
  act: (item: Item, action: string, body: object) => Promise<void>;
  token: string;
  reload: () => Promise<void>;
  setError: (message: string) => void;
}) {
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body =
      section === 'categories'
        ? {
            slug: form.get('slug'),
            nameRu: form.get('nameRu'),
            position: Number(form.get('position') || 0),
            isActive: true,
          }
        : { term: form.get('term'), severity: form.get('severity') };
    try {
      await api(`/admin/${section}`, token, { method: 'POST', body: JSON.stringify(body) });
      event.currentTarget.reset();
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ошибка создания.');
    }
  }

  const heading = (item: Item) =>
    text(
      item,
      section === 'ads'
        ? 'title'
        : section === 'users'
          ? 'email'
          : section === 'categories'
            ? 'nameRu'
            : section === 'moderation-terms'
              ? 'term'
              : 'reason',
    );

  return (
    <>
      <div className="toolbar">
        <span>{items.length} записей</span>
        {(section === 'categories' || section === 'moderation-terms') && (
          <form className="inline" onSubmit={create}>
            {section === 'categories' ? (
              <>
                <input name="slug" placeholder="slug" required />
                <input name="nameRu" placeholder="Название" required />
                <input name="position" type="number" placeholder="Порядок" />
              </>
            ) : (
              <>
                <input name="term" placeholder="Новый термин" required />
                <select name="severity">
                  <option value="review">На проверку</option>
                  <option value="block">Блокировать</option>
                </select>
              </>
            )}
            <button>Добавить</button>
          </form>
        )}
      </div>
      {items.length === 0 ? (
        <div className="empty">Здесь пока ничего нет.</div>
      ) : (
        <div className="cards">
          {items.map((item) => (
            <article key={item.id}>
              <div className="card-title">
                <strong>{heading(item)}</strong>
                <span>
                  {text(
                    item,
                    section === 'moderation-terms'
                      ? 'severity'
                      : section === 'categories'
                        ? 'isActive'
                        : 'status',
                  )}
                </span>
              </div>
              {section === 'ads' && (
                <>
                  <p>{text(item, 'description')}</p>
                  <div className="actions">
                    <button
                      onClick={() =>
                        void act(item, 'approve', { note: 'Проверено администратором' })
                      }
                    >
                      Одобрить
                    </button>
                    <button
                      className="danger"
                      onClick={() =>
                        void act(item, 'reject', { note: 'Отклонено администратором' })
                      }
                    >
                      Отклонить
                    </button>
                    <button
                      className="secondary"
                      onClick={() => void act(item, 'restore', { note: 'Повторная проверка' })}
                    >
                      Вернуть
                    </button>
                  </div>
                </>
              )}
              {section === 'reports' && (
                <>
                  <p>{text(item, 'details')}</p>
                  <div className="actions">
                    <button
                      className="danger"
                      onClick={() =>
                        void act(item, 'review', {
                          status: 'resolved',
                          note: 'Жалоба рассмотрена, объявление скрыто',
                          hideAd: true,
                        })
                      }
                    >
                      Скрыть и закрыть
                    </button>
                    <button
                      className="secondary"
                      onClick={() =>
                        void act(item, 'review', {
                          status: 'dismissed',
                          note: 'Нарушение не подтверждено',
                          hideAd: false,
                        })
                      }
                    >
                      Отклонить жалобу
                    </button>
                  </div>
                </>
              )}
              {section === 'users' && (
                <div className="actions">
                  <button
                    className="danger"
                    onClick={() =>
                      void act(item, 'suspend', { note: 'Заблокировано администратором' })
                    }
                  >
                    Заблокировать
                  </button>
                  <button
                    className="secondary"
                    onClick={() => void act(item, 'restore', { note: 'Доступ восстановлен' })}
                  >
                    Восстановить
                  </button>
                </div>
              )}
              {(section === 'categories' || section === 'moderation-terms') && (
                <button
                  className="secondary"
                  onClick={() => void act(item, 'edit', { isActive: item.isActive !== true })}
                >
                  {item.isActive === true ? 'Отключить' : 'Включить'}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
