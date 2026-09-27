import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import {
  Download,
  FileArchive,
  FileBox,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

type ProductFile = {
  id: string;
  product_id: string;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  file_format: string | null;
  created_at: string;
};

const MAX_STL_SIZE = 500 * 1024 * 1024;

function formatFileSize(value: number | null): string {
  if (!value || value <= 0) {
    return 'Tamanho desconhecido';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }

  return `${size.toLocaleString('pt-BR', {
    maximumFractionDigits: unit === 0 ? 0 : 1,
  })} ${units[unit]}`;
}

function safeFileName(file: File): string {
  const cleaned = file.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');

  return cleaned || 'modelo.stl';
}

function getProductFileStoragePath(
  productId: string,
  fileName: string,
): string {
  return `${productId}/${crypto.randomUUID()}-${fileName}`;
}

export function ProductFileManager({
  productId,
  stlEnabled,
}: {
  productId: string;
  stlEnabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<ProductFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadFiles = async () => {
    setLoading(true);
    setError('');

    try {
      const {
        data,
        error: queryError,
      } = await supabase
        .from('product_files')
        .select(
          `
            id,
            product_id,
            file_name,
            storage_path,
            file_size,
            file_format,
            created_at
          `,
        )
        .eq('product_id', productId)
        .order('created_at', {
          ascending: false,
        });

      if (queryError) {
        throw queryError;
      }

      setFiles((data ?? []) as ProductFile[]);
    } catch (loadError) {
      console.error(
        '[AdminFile] Erro ao carregar arquivos STL:',
        loadError,
      );

      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar os arquivos STL.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFiles();
  }, [productId]);

  function chooseFile(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    setError('');
    setMessage('');

    const selected = Array.from(
      event.target.files ?? [],
    );

    if (selected.length === 0) {
      event.target.value = '';
      return;
    }

    const invalid = selected.filter(
      (file) =>
        !file.name.toLowerCase().endsWith('.stl'),
    );

    if (invalid.length > 0) {
      setError(
        'Somente arquivos .STL podem ser enviados.',
      );
      event.target.value = '';
      return;
    }

    const tooLarge = selected.find(
      (file) => file.size > MAX_STL_SIZE,
    );

    if (tooLarge) {
      setError(
        `"${tooLarge.name}" excede o limite de 500 MB.`,
      );
      event.target.value = '';
      return;
    }

    // O usuário pode selecionar vários STL de uma vez.
    setPendingFiles(selected);

    event.target.value = '';
  }

  const [pendingFiles, setPendingFiles] =
    useState<File[]>([]);

  async function uploadFiles() {
    if (pendingFiles.length === 0) {
      setError(
        'Selecione pelo menos um arquivo STL.',
      );
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');

    const uploadedStoragePaths: string[] = [];
    const insertedIds: string[] = [];

    try {
      for (const file of pendingFiles) {
        const fileName = safeFileName(file);
        const storagePath =
          getProductFileStoragePath(
            productId,
            fileName,
          );

        const {
          error: storageError,
        } = await supabase.storage
          .from('product-files')
          .upload(
            storagePath,
            file,
            {
              upsert: false,
              contentType:
                'application/octet-stream',
              cacheControl: '31536000',
            },
          );

        if (storageError) {
          throw storageError;
        }

        uploadedStoragePaths.push(
          storagePath,
        );

        const {
          data: inserted,
          error: insertError,
        } = await supabase
          .from('product_files')
          .insert({
            product_id: productId,
            file_name: file.name,
            storage_path:
              storagePath,
            file_size: file.size,
            file_format: 'STL',
          })
          .select('id')
          .single();

        if (insertError) {
          throw insertError;
        }

        insertedIds.push(inserted.id);
      }

      setPendingFiles([]);
      setMessage(
        pendingFiles.length === 1
          ? 'Arquivo STL enviado com sucesso.'
          : `${pendingFiles.length} arquivos STL enviados com sucesso.`,
      );

      await loadFiles();
    } catch (uploadError) {
      console.error(
        '[AdminFile] Erro no upload STL:',
        uploadError,
      );

      if (insertedIds.length > 0) {
        await supabase
          .from('product_files')
          .delete()
          .in('id', insertedIds);
      }

      if (uploadedStoragePaths.length > 0) {
        await supabase.storage
          .from('product-files')
          .remove(
            uploadedStoragePaths,
          );
      }

      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Não foi possível enviar o arquivo STL.',
      );

      await loadFiles();
    } finally {
      setUploading(false);
    }
  }

  async function downloadFile(
    file: ProductFile,
  ) {
    setWorkingId(file.id);
    setError('');
    setMessage('');

    try {
      const {
        data,
        error: signedUrlError,
      } = await supabase.storage
        .from('product-files')
        .createSignedUrl(
          file.storage_path,
          60 * 5,
        );

      if (signedUrlError) {
        throw signedUrlError;
      }

      window.open(
        data.signedUrl,
        '_blank',
        'noopener,noreferrer',
      );
    } catch (downloadError) {
      console.error(
        '[AdminFile] Erro ao gerar URL do STL:',
        downloadError,
      );

      setError(
        downloadError instanceof Error
          ? downloadError.message
          : 'Não foi possível abrir o arquivo STL.',
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function removeFile(
    file: ProductFile,
  ) {
    const confirmed =
      window.confirm(
        `Excluir o arquivo "${file.file_name}"? Esta ação não pode ser desfeita.`,
      );

    if (!confirmed) {
      return;
    }

    setWorkingId(file.id);
    setError('');
    setMessage('');

    try {
      const {
        error: storageError,
      } = await supabase.storage
        .from('product-files')
        .remove([file.storage_path]);

      if (storageError) {
        throw storageError;
      }

      const {
        error: deleteError,
      } = await supabase
        .from('product_files')
        .delete()
        .eq('id', file.id);

      if (deleteError) {
        throw deleteError;
      }

      setMessage(
        'Arquivo STL excluído com sucesso.',
      );

      await loadFiles();
    } catch (removeError) {
      console.error(
        '[AdminFile] Erro ao excluir STL:',
        removeError,
      );

      setError(
        removeError instanceof Error
          ? removeError.message
          : 'Não foi possível excluir o arquivo STL.',
      );
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <section className="admin-file-manager admin-panel">
      <div className="panel-head">
        <div>
          <h2>Arquivo STL</h2>
          <p>
            Arquivos mantidos em armazenamento privado. Eles não ficam disponíveis publicamente.
          </p>
        </div>

        <span
          className={
            stlEnabled
              ? 'event-pill success'
              : 'event-pill'
          }
        >
          {stlEnabled
            ? 'STL ATIVO'
            : 'STL DESATIVADO'}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        hidden
        multiple
        accept=".stl,model/stl,application/sla"
        onChange={chooseFile}
      />

      <div className="admin-upload-zone">
        <FileBox size={30} />

        <strong>
          Envie o(s) arquivo(s) STL deste produto
        </strong>

        <small>
          Somente .STL, até 500 MB por arquivo.
          Você pode manter várias versões do mesmo produto.
        </small>

        <button
          type="button"
          className="btn btn-outline"
          onClick={() =>
            inputRef.current?.click()
          }
          disabled={uploading}
        >
          <Upload size={16} />
          SELECIONAR STL
        </button>
      </div>

      {pendingFiles.length > 0 && (
        <div className="admin-selected-files">
          <div>
            <strong>
              {pendingFiles.length} arquivo(s)
              selecionado(s)
            </strong>

            <div
              style={{
                display: 'grid',
                gap: 4,
                marginTop: 6,
              }}
            >
              {pendingFiles.map((file) => (
                <small
                  key={`${file.name}-${file.size}`}
                >
                  {file.name} ·{' '}
                  {formatFileSize(file.size)}
                </small>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-dark"
            onClick={() =>
              void uploadFiles()
            }
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2
                  size={16}
                  className="spin"
                />
                ENVIANDO...
              </>
            ) : (
              <>
                <Upload size={16} />
                ENVIAR STL
              </>
            )}
          </button>
        </div>
      )}

      {message && (
        <p className="admin-success-message">
          {message}
        </p>
      )}

      {error && (
        <p className="admin-error-message">
          {error}
        </p>
      )}

      {loading ? (
        <div className="admin-empty-state">
          <Loader2
            size={24}
            className="spin"
          />
          <p>Carregando arquivos...</p>
        </div>
      ) : files.length === 0 ? (
        <div className="admin-empty-state">
          <FileArchive size={28} />
          <p>
            Nenhum arquivo STL cadastrado para este produto.
          </p>
          {stlEnabled && (
            <small>
              Antes de anunciar a venda do STL, envie o arquivo correspondente.
            </small>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: '0.65rem',
          }}
        >
          {files.map((file) => {
            const busy =
              workingId === file.id;

            return (
              <article
                key={file.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent:
                    'space-between',
                  gap: '1rem',
                  padding: '1rem',
                  border:
                    '1px solid rgba(0,0,0,.12)',
                  borderRadius: 8,
                  background:
                    'rgba(255,255,255,.7)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems:
                      'center',
                    gap: '0.75rem',
                    minWidth: 0,
                  }}
                >
                  <FileBox
                    size={25}
                    style={{
                      flex:
                        '0 0 auto',
                    }}
                  />

                  <div
                    style={{
                      minWidth: 0,
                    }}
                  >
                    <strong
                      style={{
                        display:
                          'block',
                        overflow:
                          'hidden',
                        textOverflow:
                          'ellipsis',
                        whiteSpace:
                          'nowrap',
                      }}
                    >
                      {file.file_name}
                    </strong>

                    <small
                      style={{
                        display:
                          'block',
                        marginTop: 3,
                        opacity: 0.65,
                      }}
                    >
                      {file.file_format ||
                        'STL'}{' '}
                      ·{' '}
                      {formatFileSize(
                        file.file_size,
                      )}{' '}
                      ·{' '}
                      {new Date(
                        file.created_at,
                      ).toLocaleDateString(
                        'pt-BR',
                      )}
                    </small>
                  </div>
                </div>

                <div
                  style={{
                    display:
                      'flex',
                    gap: 6,
                    flex:
                      '0 0 auto',
                  }}
                >
                  <button
                    type="button"
                    className="icon-button"
                    title="Abrir/baixar STL"
                    aria-label={`Abrir ${file.file_name}`}
                    onClick={() =>
                      void downloadFile(
                        file,
                      )
                    }
                    disabled={
                      busy ||
                      uploading
                    }
                  >
                    {busy ? (
                      <Loader2
                        size={16}
                        className="spin"
                      />
                    ) : (
                      <Download
                        size={16}
                      />
                    )}
                  </button>

                  <button
                    type="button"
                    className="icon-button"
                    title="Excluir STL"
                    aria-label={`Excluir ${file.file_name}`}
                    onClick={() =>
                      void removeFile(
                        file,
                      )
                    }
                    disabled={
                      busy ||
                      uploading
                    }
                  >
                    <Trash2
                      size={16}
                    />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {stlEnabled &&
        files.length === 0 && (
          <div
            className="admin-alert warning"
            style={{
              marginTop: '1rem',
            }}
          >
            O STL está habilitado para venda, mas nenhum arquivo foi cadastrado ainda.
          </div>
        )}
    </section>
  );
}
