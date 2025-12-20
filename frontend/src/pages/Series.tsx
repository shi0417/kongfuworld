import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import NavBar from '../components/NavBar/NavBar';
import Footer from '../components/Footer/Footer';
import SeriesToolbar, { type ViewMode } from '../components/Series/SeriesToolbar';
import SeriesFilters from '../components/Series/SeriesFilters';
import SeriesTopFilters from '../components/Series/SeriesTopFilters';
import SeriesGrid from '../components/Series/SeriesGrid';
import Pagination from '../components/Series/Pagination';
import NovelService, { type GenreItem, type SeriesListItem } from '../services/novelService';
import styles from './Series.module.css';

const clampInt = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const parseNumberList = (raw: string | null): number[] => {
  if (!raw) return [];
  const ids = raw
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isFinite(n) && n > 0);
  // 需求：去重 + 升序（用于 URL 形态与恢复一致）
  return Array.from(new Set(ids)).sort((a, b) => a - b);
};

const Series: React.FC = () => {
  const [sp, setSp] = useSearchParams();
  const prevPageRef = useRef<number | null>(null);

  const urlState = useMemo(() => {
    const page = clampInt(parseInt(sp.get('page') || '1', 10) || 1, 1, 9999);
    const pageSize = clampInt(parseInt(sp.get('pageSize') || '24', 10) || 24, 1, 48);
    const query = (sp.get('query') || '').trim();
    const statusRaw = (sp.get('status') || '').trim().toLowerCase();
    const status = (statusRaw === 'ongoing' || statusRaw === 'completed' || statusRaw === 'hiatus') ? statusRaw : '';
    const lang = (() => {
      const raw = (sp.get('lang') || '').trim().replace(/\s+/g, ' ');
      if (!raw) return '';
      // 轻量限制：与后端 normalizeLang 一致的长度约束
      if (raw.length > 30) return '';
      return raw;
    })();
    const sortRaw = (sp.get('sort') || 'latest').trim();
    const sort = ['latest', 'rating', 'chapters', 'alpha'].includes(sortRaw) ? sortRaw : 'latest';
    const viewRaw = (sp.get('view') || 'grid').trim();
    const view = (viewRaw === 'list' ? 'list' : 'grid') as ViewMode;
    const genres = parseNumberList(sp.get('genres'));
    return { page, pageSize, query, status, lang, sort, view, genres };
  }, [sp]);

  // 兼容 HomeV2: /series?sort=xxx（把未知 sort 归一到 latest，但保留能正常渲染）
  useEffect(() => {
    const raw = (sp.get('sort') || '').trim();
    if (!raw) return;
    const known = ['latest', 'rating', 'chapters', 'alpha', 'trending', 'new', 'popular_week', 'based_on_you'];
    if (!known.includes(raw)) return;
    const map: Record<string, string> = { trending: 'latest', new: 'latest', popular_week: 'latest', based_on_you: 'latest' };
    const next = map[raw];
    if (!next) return;
    const nextSp = new URLSearchParams(sp);
    nextSp.set('sort', next);
    setSp(nextSp, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 翻页后自动回到顶部（平滑）
  useEffect(() => {
    if (prevPageRef.current !== null && prevPageRef.current !== urlState.page) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    prevPageRef.current = urlState.page;
  }, [urlState.page]);

  const [queryInput, setQueryInput] = useState(urlState.query);
  useEffect(() => setQueryInput(urlState.query), [urlState.query]);

  const [genres, setGenres] = useState<GenreItem[]>([]);
  const [genresLoading, setGenresLoading] = useState(false);

  const [languages, setLanguages] = useState<string[]>([]);
  const [languagesLoading, setLanguagesLoading] = useState(false);

  const [items, setItems] = useState<SeriesListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [reloadTick, setReloadTick] = useState(0);

  const [filtersOpen, setFiltersOpen] = useState(false);

  const setParam = (patch: Record<string, string | null>, resetPage: boolean = true) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    });
    if (resetPage) next.set('page', '1');
    setSp(next);
  };

  // URL 同步 setter（要求：clone URLSearchParams；任意筛选变化 page=1；Any 则删除参数；genres 升序去重）
  const setLang = (token: string | 'any') => {
    const next = token === 'any' ? null : String(token).trim().replace(/\s+/g, ' ');
    setParam({ lang: next || null });
  };

  const setStatus = (st: 'ongoing' | 'completed' | 'hiatus' | 'any') => {
    setParam({ status: st === 'any' ? null : st });
  };

  const toggleGenre = (id: number) => {
    const gid = Number(id);
    if (!Number.isFinite(gid) || gid <= 0) return;
    const has = urlState.genres.includes(gid);
    const nextList = (has ? urlState.genres.filter(x => x !== gid) : [...urlState.genres, gid]);
    const normalized = Array.from(new Set(nextList)).sort((a, b) => a - b);
    setParam({ genres: normalized.length ? normalized.join(',') : null });
  };

  useEffect(() => {
    (async () => {
      try {
        setGenresLoading(true);
        const list = await NovelService.getGenres();
        setGenres(list);
      } catch {
        setGenres([]);
      } finally {
        setGenresLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLanguagesLoading(true);
        const list = await NovelService.getSeriesLanguages();
        setLanguages(Array.isArray(list) ? list : []);
      } catch {
        setLanguages([]);
      } finally {
        setLanguagesLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');
        const data = await NovelService.getSeriesList({
          page: urlState.page,
          pageSize: urlState.pageSize,
          query: urlState.query || undefined,
          status: urlState.status || undefined,
          lang: urlState.lang || undefined,
          sort: urlState.sort,
          genres: urlState.genres
        });
        setItems(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } catch (e: any) {
        setItems([]);
        setTotal(0);
        setTotalPages(1);
        setError(e?.message || '加载失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [urlState.page, urlState.pageSize, urlState.query, urlState.status, urlState.lang, urlState.sort, urlState.genres.join(','), reloadTick]);

  const currentFilters = useMemo(() => {
    return { genres: urlState.genres, status: urlState.status, lang: urlState.lang };
  }, [urlState.genres, urlState.status, urlState.lang]);

  // Clear all：清 lang/status/genres/query；并强制 page=1（不改 sort/view/pageSize 参数语义）
  const onClearAll = () => {
    const next = new URLSearchParams(sp);
    next.delete('lang');
    next.delete('status');
    next.delete('genres');
    next.delete('query');
    next.set('page', '1');
    setSp(next);
  };

  const genreNameMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const g of genres) {
      // UX: summary 里的 genre chip 也用英文优先
      const name = (g.name || '').trim();
      const slug = (g.slug || '').trim();
      const label = name
        ? name
        : slug
          ? slug
              .split(/[-_]/g)
              .filter(Boolean)
              .map(w => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ')
          : ((g.chinese_name || `#${g.id}`) as string);
      m.set(Number(g.id), label);
    }
    return m;
  }, [genres]);

  const genreEnglishByChineseName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const g of genres) {
      const cn = (g.chinese_name || '').trim();
      if (!cn) continue;
      const name = (g.name || '').trim();
      const slug = (g.slug || '').trim();
      const label = name
        ? name
        : slug
          ? slug
              .split(/[-_]/g)
              .filter(Boolean)
              .map(w => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ')
          : cn;
      m[cn] = label;
    }
    return m;
  }, [genres]);

  const activeSummary = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    const hasNonSort =
      !!urlState.query ||
      urlState.genres.length > 0 ||
      !!urlState.status ||
      !!urlState.lang;

    // query
    if (urlState.query) {
      const q = urlState.query;
      chips.push({
        key: `q:${q}`,
        label: `Search: ${q}`,
        onRemove: () => setParam({ query: null })
      });
    }

    // genres
    if (urlState.genres.length > 0) {
      for (const id of urlState.genres) {
        const name = genreNameMap.get(id) || `#${id}`;
        chips.push({
          key: `g:${id}`,
          label: name,
          onRemove: () => {
            const next = urlState.genres.filter(x => x !== id);
            setParam({ genres: next.length ? next.join(',') : null });
          }
        });
      }
    }

    // status
    if (urlState.status) {
      const map: Record<string, string> = { ongoing: 'Ongoing', completed: 'Completed', hiatus: 'Hiatus' };
      const label = map[urlState.status] || urlState.status;
      chips.push({
        key: `s:${urlState.status}`,
        label,
        onRemove: () => setParam({ status: null })
      });
    }

    // lang
    if (urlState.lang) {
      chips.push({
        key: `l:${urlState.lang}`,
        label: urlState.lang.toUpperCase(),
        onRemove: () => setParam({ lang: null })
      });
    }

    // sort：只要有任何激活过滤，或者 sort 本身不是 latest，就展示
    if (hasNonSort || urlState.sort !== 'latest') {
      const sortLabelMap: Record<string, string> = {
        latest: 'Latest',
        rating: 'Rating ↓',
        chapters: 'Chapters ↓',
        alpha: 'A-Z'
      };
      const label = sortLabelMap[urlState.sort] || 'Latest';
      chips.push({
        key: `sort:${urlState.sort}`,
        label,
        onRemove: () => setParam({ sort: 'latest' })
      });
    }

    const show = chips.length > 0;
    return { show, chips };
  }, [genreNameMap, urlState.genres, urlState.lang, urlState.query, urlState.sort, urlState.status]);

  const headerTitle = 'Series';
  const subtitle =
    `${total} results` +
    (genresLoading ? ' · loading genres...' : '') +
    (languagesLoading ? ' · loading languages...' : '');

  return (
    <div className={styles.page}>
      <NavBar />
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.h1}>{headerTitle}</h1>
          <div className={styles.subtitle}>{subtitle}</div>
        </div>

        <SeriesToolbar
          queryInput={queryInput}
          onQueryInputChange={setQueryInput}
          onSubmitSearch={() => {
            setFiltersOpen(false);
            setParam({ query: queryInput.trim() || null });
          }}
          sort={urlState.sort}
          onSortChange={(v) => {
            setFiltersOpen(false);
            setParam({ sort: v });
          }}
          viewMode={urlState.view}
          onViewModeChange={(v) => {
            setParam({ view: v }, false);
          }}
          onOpenFilters={() => setFiltersOpen(true)}
        />

        <SeriesTopFilters
          languages={languages}
          lang={urlState.lang}
          onSetLang={(v) => {
            setLang(v);
          }}
          status={urlState.status}
          onSetStatus={(v) => {
            setStatus(v);
          }}
          genres={genres}
          selectedGenres={urlState.genres}
          onToggleGenre={(id) => {
            toggleGenre(id);
          }}
          onClearAll={() => {
            setFiltersOpen(false);
            onClearAll();
          }}
        />

        {activeSummary.show && (
          <div className={styles.summary}>
            <div className={styles.chips}>
              {activeSummary.chips.map((c) => (
                <button
                  key={c.key}
                  className={styles.chip}
                  onClick={c.onRemove}
                  title="Remove"
                  type="button"
                >
                  <span className={styles.chipLabel}>{c.label}</span>
                  <span className={styles.chipX}>×</span>
                </button>
              ))}
            </div>
            <button
              className={styles.clearAllBtn}
              onClick={() => {
                setFiltersOpen(false);
                onClearAll();
              }}
              type="button"
            >
              Clear All
            </button>
          </div>
        )}

        <div className={styles.main}>
          <div className={styles.content}>
            {error ? (
              <div className={styles.state}>
                <div className={styles.error}>{error}</div>
                <button className={styles.btn} onClick={() => setReloadTick(t => t + 1)}>Retry</button>
              </div>
            ) : loading ? (
              <SeriesGrid items={[]} viewMode={urlState.view} loading genreLabelMap={genreEnglishByChineseName} />
            ) : items.length === 0 ? (
              <div className={styles.state}>
                <div className={styles.emptyTitle}>No series match your filters</div>
                <div className={styles.emptyHint}>Try removing some filters or searching with a different keyword.</div>
                <button className={styles.btn} onClick={onClearAll}>Clear Filters</button>
              </div>
            ) : (
              <>
                <SeriesGrid items={items} viewMode={urlState.view} genreLabelMap={genreEnglishByChineseName} />
                <Pagination page={urlState.page} totalPages={totalPages} onChange={(p) => setParam({ page: String(p) }, false)} />
              </>
            )}
          </div>
        </div>

        <SeriesFilters
          variant="drawer"
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          genres={genres}
          languages={languages}
          value={currentFilters}
          onSetLang={(v) => {
            setLang(v);
            setFiltersOpen(false);
          }}
          onSetStatus={(v) => {
            setStatus(v);
            setFiltersOpen(false);
          }}
          onToggleGenre={(id) => {
            toggleGenre(id);
            setFiltersOpen(false);
          }}
          onClearAll={() => {
            onClearAll();
            setFiltersOpen(false);
          }}
        />
      </div>
      <Footer />
    </div>
  );
};

export default Series;


