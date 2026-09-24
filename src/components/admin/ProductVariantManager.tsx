import {
  Edit3,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  useEffect,
  useState,
} from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../../lib/supabase';

type ProductVariant = {
  id: string;
  name: string;
  material: string | null;
  color: string | null;
  size: string | null;
  price_modifier: number | string;
  stock: number | null;
  active: boolean;
};

type VariantForm = {
  name: string;
  material: string;
  color: string;
  size: string;
  priceModifier: string;
  stock: string;
  active: boolean;
};

const emptyVariantForm: VariantForm = {
  name: '',
  material: '',
  color: '',
  size: '',
  priceModifier: '0',
  stock: '',
  active: true,
};

function parseDecimal(value: string) {
  return Number(value.replace(',', '.').trim());
}

export function ProductVariantManager({
  productId,
}: {
  productId: string;
}) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [form, setForm] = useState<VariantForm>(emptyVariantForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadVariants() {
    setLoading(true);
    setError('');

    try {
      const { data, error: queryError } = await supabase
        .from('product_variants')
        .select(
          'id, name, material, color, size, price_modifier, stock, active',
        )
        .eq('product_id', productId)
        .order('created_at', { ascending: true });

      if (queryError) {
        throw queryError;
      }

      setVariants((data ?? []) as ProductVariant[]);
    } catch (loadError) {
      console.error('[Admin] Erro ao carregar variantes:', loadError);
      setError('Não foi possível carregar as variantes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadVariants();
    setForm(emptyVariantForm);
    setEditingId(null);
  }, [productId]);

  function updateForm<K extends keyof VariantForm>(
    field: K,
    value: VariantForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function startEditing(variant: ProductVariant) {
    setEditingId(variant.id);
    setForm({
      name: variant.name,
      material: variant.material ?? '',
      color: variant.color ?? '',
      size: variant.size ?? '',
      priceModifier: String(variant.price_modifier),
      stock: variant.stock === null ? '' : String(variant.stock),
      active: variant.active,
    });
    setError('');
    setSuccess('');
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(emptyVariantForm);
    setError('');
  }

  async function saveVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = form.name.trim();
    const priceModifier = parseDecimal(form.priceModifier);
    const stock = form.stock.trim() ? Number(form.stock) : null;

    if (!name) {
      setError('Informe o nome da variante.');
      return;
    }

    if (!Number.isFinite(priceModifier)) {
      setError('Informe um ajuste de preço válido.');
      return;
    }

    if (
      stock !== null &&
      (!Number.isInteger(stock) || stock < 0)
    ) {
      setError('O estoque deve ser um número inteiro maior ou igual a zero.');
      return;
    }

    const payload = {
      product_id: productId,
      name,
      material: form.material.trim() || null,
      color: form.color.trim() || null,
      size: form.size.trim() || null,
      price_modifier: priceModifier,
      stock,
      active: form.active,
    };

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const request = editingId
        ? supabase
            .from('product_variants')
            .update(payload)
            .eq('id', editingId)
        : supabase
            .from('product_variants')
            .insert(payload);

      const { error: saveError } = await request;

      if (saveError) {
        throw saveError;
      }

      setSuccess(
        editingId
          ? 'Variante atualizada com sucesso.'
          : 'Variante cadastrada com sucesso.',
      );
      setForm(emptyVariantForm);
      setEditingId(null);
      await loadVariants();
    } catch (saveError) {
      console.error('[Admin] Erro ao salvar variante:', saveError);
      setError('Não foi possível salvar a variante.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteVariant(variant: ProductVariant) {
    const confirmed = window.confirm(
      `Deseja excluir a variante "${variant.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(variant.id);
    setError('');
    setSuccess('');

    try {
      const { error: deleteError } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', variant.id);

      if (deleteError) {
        throw deleteError;
      }

      if (editingId === variant.id) {
        cancelEditing();
      }

      setSuccess('Variante excluída com sucesso.');
      await loadVariants();
    } catch (deleteError) {
      console.error('[Admin] Erro ao excluir variante:', deleteError);
      setError('Não foi possível excluir a variante.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="admin-variant-manager">
      <div className="admin-variant-header">
        <div>
          <h3>Variantes do produto</h3>
          <p>
            Cadastre opções de material, cor, tamanho, estoque e ajuste de preço.
          </p>
        </div>

        <span>{variants.length} cadastrada(s)</span>
      </div>

      <form className="admin-variant-form" onSubmit={saveVariant}>
        <input
          value={form.name}
          onChange={(event) => updateForm('name', event.target.value)}
          placeholder="Nome da variante"
          required
        />
        <input
          value={form.material}
          onChange={(event) => updateForm('material', event.target.value)}
          placeholder="Material"
        />
        <input
          value={form.color}
          onChange={(event) => updateForm('color', event.target.value)}
          placeholder="Cor"
        />
        <input
          value={form.size}
          onChange={(event) => updateForm('size', event.target.value)}
          placeholder="Tamanho"
        />
        <input
          value={form.priceModifier}
          onChange={(event) =>
            updateForm('priceModifier', event.target.value)
          }
          inputMode="decimal"
          placeholder="Ajuste R$"
          required
        />
        <input
          value={form.stock}
          onChange={(event) => updateForm('stock', event.target.value)}
          inputMode="numeric"
          placeholder="Estoque"
        />

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) => updateForm('active', event.target.checked)}
          />
          Ativa
        </label>

        <div className="admin-variant-form-actions">
          {editingId && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={cancelEditing}
              disabled={saving}
            >
              <X size={15} />
              CANCELAR
            </button>
          )}

          <button type="submit" className="btn btn-dark" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="admin-spin" size={15} />
                SALVANDO...
              </>
            ) : (
              <>
                <Plus size={15} />
                {editingId ? 'SALVAR VARIANTE' : 'ADICIONAR VARIANTE'}
              </>
            )}
          </button>
        </div>
      </form>

      {error && <div className="admin-error-message">{error}</div>}
      {success && <div className="admin-success-message">{success}</div>}

      {loading ? (
        <div className="admin-variant-empty">
          <Loader2 className="admin-spin" size={20} />
          Carregando variantes...
        </div>
      ) : variants.length === 0 ? (
        <div className="admin-variant-empty">
          Nenhuma variante cadastrada.
        </div>
      ) : (
        <div className="admin-variant-table-wrap">
          <table>
            <thead>
              <tr>
                <th>VARIANTE</th>
                <th>DETALHES</th>
                <th>AJUSTE</th>
                <th>ESTOQUE</th>
                <th>STATUS</th>
                <th>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((variant) => (
                <tr key={variant.id}>
                  <td><strong>{variant.name}</strong></td>
                  <td>
                    {[variant.material, variant.color, variant.size]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
                  <td>
                    {Number(variant.price_modifier).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      signDisplay: 'always',
                    })}
                  </td>
                  <td>{variant.stock ?? 'Sob consulta'}</td>
                  <td>{variant.active ? 'Ativa' : 'Inativa'}</td>
                  <td>
                    <div className="product-row-actions">
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => startEditing(variant)}
                        aria-label={`Editar ${variant.name}`}
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => void deleteVariant(variant)}
                        disabled={deletingId === variant.id}
                        aria-label={`Excluir ${variant.name}`}
                      >
                        {deletingId === variant.id ? (
                          <Loader2 className="admin-spin" size={15} />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
