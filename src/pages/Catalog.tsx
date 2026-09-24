
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Filter,
  SlidersHorizontal,
} from 'lucide-react';

import { ProductCard } from '../components/ProductCard';
import {
  useProducts,
  type Product,
} from '../lib/catalog';

export function Catalog({
  type,
  onAdd,
}: {
  type: 'stl' | 'physical';
  onAdd: (p: Product) => void;
}) {
  const [params] = useSearchParams();

  const [category, setCategory] = useState(
    params.get('category') || 'Todos'
  );

  const [search, setSearch] = useState(
    params.get('search') || ''
  );

  const {
    products,
    loading,
    error,
  } = useProducts();

  const categories = useMemo(() => {
    const values = products
      .filter((product) => product.type === type)
      .map((product) => product.category)
      .filter(Boolean);

    return ['Todos', ...Array.from(new Set(values)).sort()];
  }, [products, type]);

  const filtered = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return products.filter((product) => {
      const matchesType = product.type === type;

      const matchesCategory =
        category === 'Todos' ||
        product.category === category;

      const matchesSearch =
        !normalizedSearch ||
        product.name
          .toLowerCase()
          .includes(normalizedSearch) ||
        product.description
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        product.category
          .toLowerCase()
          .includes(normalizedSearch);

      return (
        matchesType &&
        matchesCategory &&
        matchesSearch
      );
    });
  }, [products, type, category, search]);

  if (loading) {
    return (
      <section className="catalog-page">
        <div className="container">
          <div className="empty-state">
            <h3>Carregando catálogo...</h3>
            <p>
              Buscando produtos atualizados da Forge3D.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="catalog-page">
        <div className="container">
          <div className="empty-state">
            <h3>Erro ao carregar catálogo.</h3>
            <p>
              Verifique a configuração do Supabase.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="catalog-page">
      <div className="container">
        <div className="catalog-head">
          <div>
            <span className="eyebrow">
              {type === 'stl'
                ? 'MODELOS DIGITAIS'
                : 'PRODUÇÃO SOB DEMANDA'}
            </span>

            <h1>
              {type === 'stl'
                ? 'Arquivos STL'
                : 'Impressão 3D'}
            </h1>

            <p>
              {type === 'stl'
                ? 'Modelos prontos para você baixar e imprimir.'
                : 'Peças impressas com opções para você escolher.'}
            </p>
          </div>

          <span className="result-count">
            {filtered.length} produtos
          </span>
        </div>

        <div className="catalog-toolbar">
          <div className="chips">
            {categories.map((item) => (
              <button
                type="button"
                className={
                  category === item ? 'active' : ''
                }
                key={item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <label className="catalog-search">
            <Filter size={17} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Buscar nesta categoria..."
            />
          </label>

          <button
            type="button"
            className="filter-mobile"
          >
            <SlidersHorizontal size={17} />
            Filtros
          </button>
        </div>

        {filtered.length > 0 ? (
          <div className="product-grid catalog-grid">
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                p={product}
                onAdd={onAdd}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>Nenhum produto encontrado.</h3>

            <p>
              Tente outra busca ou categoria.
            </p>

            <Link
              to={
                type === 'stl'
                  ? '/stl'
                  : '/impressao-3d'
              }
              onClick={() => {
                setCategory('Todos');
                setSearch('');
              }}
            >
              LIMPAR FILTROS
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
