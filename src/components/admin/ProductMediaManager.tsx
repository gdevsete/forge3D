import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import {
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Loader2,
  Play,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

type MediaType = 'image' | 'video';

type ProductMedia = {
  id: string;
  product_id: string;
  media_type: MediaType;
  media_url: string;
  thumbnail_url: string | null;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
};

const IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
];

const VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

function getStoragePath(mediaUrl: string): string | null {
  const marker =
    '/storage/v1/object/public/product-media/';

  const index = mediaUrl.indexOf(marker);

  if (index < 0) {
    return null;
  }

  const rawPath = mediaUrl.slice(
    index + marker.length,
  );

  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
}

function createSafeFileName(file: File): string {
  const original = file.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();

  return original || 'arquivo';
}

function sortMedia(items: ProductMedia[]): ProductMedia[] {
  return [...items].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
}

export function ProductMediaManager({
  productId,
}: {
  productId: string;
}) {
  const inputRef =
    useRef<HTMLInputElement>(null);

  const [media, setMedia] =
    useState<ProductMedia[]>([]);

  const [files, setFiles] =
    useState<File[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [uploading, setUploading] =
    useState(false);

  const [workingId, setWorkingId] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState('');

  const [error, setError] =
    useState('');

  const loadMedia = async () => {
    setLoading(true);
    setError('');

    try {
      const {
        data,
        error: queryError,
      } = await supabase
        .from('product_media')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order', {
          ascending: true,
        });

      if (queryError) {
        throw queryError;
      }

      setMedia(
        sortMedia(
          (data ?? []) as ProductMedia[],
        ),
      );
    } catch (loadError) {
      console.error(
        '[AdminMedia] Erro ao carregar mídias:',
        loadError,
      );

      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar as mídias.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMedia();
  }, [productId]);

  function selectFiles(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    setError('');
    setMessage('');

    const selected = Array.from(
      event.target.files ?? [],
    );

    const accepted: File[] = [];
    const rejected: string[] = [];

    for (const file of selected) {
      const isImage =
        IMAGE_TYPES.includes(file.type);

      const isVideo =
        VIDEO_TYPES.includes(file.type);

      const validType =
        isImage || isVideo;

      const maxSize =
        isVideo
          ? MAX_VIDEO_SIZE
          : MAX_IMAGE_SIZE;

      if (!validType) {
        rejected.push(
          `${file.name}: formato não suportado.`,
        );
        continue;
      }

      if (file.size > maxSize) {
        rejected.push(
          `${file.name}: arquivo acima do limite.`,
        );
        continue;
      }

      accepted.push(file);
    }

    setFiles(accepted);

    if (rejected.length > 0) {
      setError(
        `Alguns arquivos foram ignorados. ${rejected.join(' ')}`,
      );
    }

    event.target.value = '';
  }

  async function uploadFiles() {
    if (!files.length) {
      setError(
        'Selecione pelo menos uma imagem ou vídeo.',
      );
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');

    const uploadedStoragePaths: string[] = [];
    const insertedMediaIds: string[] = [];

    try {
      let nextOrder =
        media.reduce(
          (max, item) =>
            Math.max(max, item.sort_order),
          -1,
        ) + 1;

      let hasPrimaryImage =
        media.some(
          (item) =>
            item.media_type === 'image' &&
            item.is_primary,
        );

      for (const file of files) {
        const type: MediaType =
          file.type.startsWith('video/')
            ? 'video'
            : 'image';

        const path =
          `${productId}/${crypto.randomUUID()}-${createSafeFileName(file)}`;

        const {
          error: uploadError,
        } = await supabase.storage
          .from('product-media')
          .upload(path, file, {
            upsert: false,
            contentType:
              file.type ||
              'application/octet-stream',
            cacheControl: '31536000',
          });

        if (uploadError) {
          throw uploadError;
        }

        uploadedStoragePaths.push(path);

        const {
          data: publicUrlData,
        } = supabase.storage
          .from('product-media')
          .getPublicUrl(path);

        const isPrimary =
          type === 'image' &&
          !hasPrimaryImage;

        const {
          data: inserted,
          error: insertError,
        } = await supabase
          .from('product_media')
          .insert({
            product_id: productId,
            media_type: type,
            media_url:
              publicUrlData.publicUrl,
            thumbnail_url: null,
            alt_text: file.name,
            sort_order: nextOrder,
            is_primary: isPrimary,
          })
          .select('id')
          .single();

        if (insertError) {
          throw insertError;
        }

        insertedMediaIds.push(
          inserted.id,
        );

        if (isPrimary) {
          hasPrimaryImage = true;
          await syncProductThumbnail(
            publicUrlData.publicUrl,
          );
        }

        nextOrder += 1;
      }

      setFiles([]);

      setMessage(
        files.length === 1
          ? 'Mídia enviada com sucesso.'
          : `${files.length} mídias enviadas com sucesso.`,
      );

      await loadMedia();
    } catch (uploadError) {
      console.error(
        '[AdminMedia] Erro no upload:',
        uploadError,
      );

      // Reverte registros e arquivos criados nesta operação.
      if (insertedMediaIds.length > 0) {
        await supabase
          .from('product_media')
          .delete()
          .in(
            'id',
            insertedMediaIds,
          );
      }

      if (
        uploadedStoragePaths.length >
        0
      ) {
        await supabase.storage
          .from('product-media')
          .remove(
            uploadedStoragePaths,
          );
      }

      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Não foi possível enviar as mídias.',
      );

      await loadMedia();
    } finally {
      setUploading(false);
    }
  }


  async function syncProductThumbnail(
    mediaUrl: string | null,
  ) {
    const { error: thumbnailError } =
      await supabase
        .from('products')
        .update({
          thumbnail_url: mediaUrl,
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', productId);

    if (thumbnailError) {
      throw thumbnailError;
    }
  }

  async function setPrimary(
    item: ProductMedia,
  ) {
    if (item.media_type !== 'image') {
      return;
    }

    setWorkingId(item.id);
    setError('');
    setMessage('');

    try {
      const {
        error: resetError,
      } = await supabase
        .from('product_media')
        .update({
          is_primary: false,
        })
        .eq('product_id', productId)
        .eq('media_type', 'image');

      if (resetError) {
        throw resetError;
      }

      const {
        error: updateError,
      } = await supabase
        .from('product_media')
        .update({
          is_primary: true,
        })
        .eq('id', item.id);

      if (updateError) {
        throw updateError;
      }

      await syncProductThumbnail(
        item.media_url,
      );

      setMessage(
        'Imagem principal atualizada.',
      );

      await loadMedia();
    } catch (primaryError) {
      console.error(
        '[AdminMedia] Erro ao definir principal:',
        primaryError,
      );

      setError(
        primaryError instanceof Error
          ? primaryError.message
          : 'Não foi possível definir a imagem principal.',
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function removeMedia(
    item: ProductMedia,
  ) {
    const confirmed =
      window.confirm(
        'Excluir esta mídia definitivamente?',
      );

    if (!confirmed) {
      return;
    }

    setWorkingId(item.id);
    setError('');
    setMessage('');

    try {
      const storagePath =
        getStoragePath(
          item.media_url,
        );

      if (storagePath) {
        const {
          error: storageError,
        } = await supabase.storage
          .from('product-media')
          .remove([
            storagePath,
          ]);

        if (storageError) {
          throw storageError;
        }
      }

      const {
        error: deleteError,
      } = await supabase
        .from('product_media')
        .delete()
        .eq('id', item.id);

      if (deleteError) {
        throw deleteError;
      }

      // Se a principal foi removida, escolhe
      // automaticamente a primeira imagem restante.
      if (
        item.is_primary &&
        item.media_type === 'image'
      ) {
        const remaining =
          media
            .filter(
              (candidate) =>
                candidate.id !== item.id &&
                candidate.media_type ===
                  'image',
            )
            .sort(
              (a, b) =>
                a.sort_order -
                b.sort_order,
            );

        if (remaining[0]) {
          await setPrimary(
            remaining[0],
          );
        } else {
          await syncProductThumbnail(
            null,
          );
        }
      }

      setMessage(
        'Mídia excluída com sucesso.',
      );

      await loadMedia();
    } catch (removeError) {
      console.error(
        '[AdminMedia] Erro ao excluir mídia:',
        removeError,
      );

      setError(
        removeError instanceof Error
          ? removeError.message
          : 'Não foi possível excluir a mídia.',
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function moveMedia(
    item: ProductMedia,
    direction: 'up' | 'down',
  ) {
    const index =
      media.findIndex(
        (candidate) =>
          candidate.id === item.id,
      );

    if (index < 0) {
      return;
    }

    const targetIndex =
      direction === 'up'
        ? index - 1
        : index + 1;

    if (
      targetIndex < 0 ||
      targetIndex >= media.length
    ) {
      return;
    }

    const target =
      media[targetIndex];

    setWorkingId(item.id);
    setError('');
    setMessage('');

    try {
      // Troca as posições entre os dois itens.
      const updates = [
        {
          id: item.id,
          sort_order:
            target.sort_order,
        },
        {
          id: target.id,
          sort_order:
            item.sort_order,
        },
      ];

      for (const update of updates) {
        const {
          error: updateError,
        } = await supabase
          .from('product_media')
          .update({
            sort_order:
              update.sort_order,
          })
          .eq('id', update.id);

        if (updateError) {
          throw updateError;
        }
      }

      await loadMedia();
    } catch (moveError) {
      console.error(
        '[AdminMedia] Erro ao reordenar mídia:',
        moveError,
      );

      setError(
        moveError instanceof Error
          ? moveError.message
          : 'Não foi possível reordenar a mídia.',
      );
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <section className="admin-media-manager forge-admin-media">
      <div className="panel-head">
        <div>
          <h2>Imagens e vídeos</h2>
          <p>
            A primeira imagem principal é usada como imagem de destaque da oferta.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        hidden
        type="file"
        multiple
        accept={[
          ...IMAGE_TYPES,
          ...VIDEO_TYPES,
        ].join(',')}
        onChange={selectFiles}
      />

      <div className="admin-upload-zone">
        <ImagePlus size={28} />

        <strong>
          Selecione imagens e vídeos
        </strong>

        <small>
          JPG, PNG, WEBP ou AVIF até 10 MB.
          Vídeos MP4, WEBM ou MOV até 100 MB.
        </small>

        <button
          type="button"
          className="btn btn-dark"
          onClick={() =>
            inputRef.current?.click()
          }
          disabled={uploading}
        >
          <Upload size={16} />
          SELECIONAR ARQUIVOS
        </button>
      </div>

      {files.length > 0 && (
        <div className="admin-selected-files">
          <p>
            {files.length} arquivo(s)
            selecionado(s).
          </p>

          <button
            className="btn btn-dark"
            type="button"
            onClick={() =>
              void uploadFiles()
            }
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2
                  className="spin"
                  size={16}
                />
                ENVIANDO...
              </>
            ) : (
              <>
                <Upload size={16} />
                ENVIAR
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
            className="spin"
            size={24}
          />
          <p>Carregando mídias...</p>
        </div>
      ) : media.length === 0 ? (
        <div className="admin-empty-state">
          <ImagePlus size={28} />
          <p>
            Nenhuma mídia cadastrada.
          </p>
        </div>
      ) : (
        <div className="admin-media-grid">
          {media.map(
            (item, index) => {
              const busy =
                workingId ===
                item.id;

              return (
                <article
                  className="admin-media-card"
                  key={item.id}
                >
                  <div
                    style={{
                      position:
                        'relative',
                    }}
                  >
                    {item.media_type ===
                    'video' ? (
                      <div
                        style={{
                          position:
                            'relative',
                        }}
                      >
                        <video
                          src={
                            item.media_url
                          }
                          controls
                          playsInline
                        />

                        <span
                          style={{
                            position:
                              'absolute',
                            top: 8,
                            left: 8,
                            display:
                              'inline-flex',
                            alignItems:
                              'center',
                            gap: 4,
                            padding:
                              '4px 7px',
                            borderRadius:
                              999,
                            background:
                              'rgba(0,0,0,.75)',
                            color:
                              '#fff',
                            fontSize:
                              11,
                          }}
                        >
                          <Play
                            size={12}
                            fill="currentColor"
                          />
                          VÍDEO
                        </span>
                      </div>
                    ) : (
                      <img
                        src={
                          item.media_url
                        }
                        alt={
                          item.alt_text ??
                          'Mídia do produto'
                        }
                        loading="lazy"
                      />
                    )}
                  </div>

                  <div className="admin-media-card-body">
                    <p>
                      {item.alt_text ||
                        'Mídia sem descrição'}
                    </p>

                    <div
                      style={{
                        display:
                          'flex',
                        alignItems:
                          'center',
                        justifyContent:
                          'space-between',
                        gap: 8,
                        flexWrap:
                          'wrap',
                      }}
                    >
                      {item.is_primary ? (
                        <strong>
                          <Star
                            size={13}
                            fill="currentColor"
                          />
                          Principal
                        </strong>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            opacity: 0.65,
                          }}
                        >
                          Mídia {index + 1}
                        </span>
                      )}

                      <div className="admin-media-actions">
                        {item.media_type ===
                          'image' &&
                          !item.is_primary && (
                            <button
                              type="button"
                              onClick={() =>
                                void setPrimary(
                                  item,
                                )
                              }
                              disabled={
                                busy ||
                                uploading
                              }
                            >
                              <Star
                                size={14}
                              />
                              PRINCIPAL
                            </button>
                          )}

                        <button
                          type="button"
                          onClick={() =>
                            void moveMedia(
                              item,
                              'up',
                            )
                          }
                          disabled={
                            busy ||
                            uploading ||
                            index === 0
                          }
                          title="Mover para cima"
                        >
                          <ChevronUp
                            size={14}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void moveMedia(
                              item,
                              'down',
                            )
                          }
                          disabled={
                            busy ||
                            uploading ||
                            index ===
                              media.length -
                                1
                          }
                          title="Mover para baixo"
                        >
                          <ChevronDown
                            size={14}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void removeMedia(
                              item,
                            )
                          }
                          disabled={
                            busy ||
                            uploading
                          }
                        >
                          {busy ? (
                            <Loader2
                              className="spin"
                              size={14}
                            />
                          ) : (
                            <Trash2
                              size={14}
                            />
                          )}
                          EXCLUIR
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            },
          )}
        </div>
      )}

      <style>{`
        /* ============================================================
           FORGE3D — GALERIA DO ADMIN
           CSS isolado deste componente para não interferir no restante
           do painel administrativo.
        ============================================================ */

        .forge-admin-media {
          width: 100%;
          box-sizing: border-box;
        }

        .forge-admin-media .admin-upload-zone {
          min-height: 150px !important;
          height: auto !important;
          padding: 24px 22px !important;
          box-sizing: border-box;
          display: flex !important;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px dashed #cfd2d6 !important;
          background: #fafafa !important;
        }

        .forge-admin-media .admin-upload-zone > svg {
          width: 28px;
          height: 28px;
          margin-bottom: 2px;
        }

        .forge-admin-media .admin-upload-zone strong {
          font-size: 14px;
          line-height: 1.25;
          text-align: center;
        }

        .forge-admin-media .admin-upload-zone small {
          max-width: 680px;
          font-size: 11px;
          line-height: 1.5;
          text-align: center;
          color: #777;
        }

        .forge-admin-media .admin-upload-zone .btn {
          min-height: 40px;
          margin-top: 4px;
        }

        .forge-admin-media .admin-selected-files {
          margin-top: 12px !important;
          padding: 12px 14px !important;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          background: #f7f7f5;
          border: 1px solid #e2e3e5;
        }

        .forge-admin-media .admin-success-message,
        .forge-admin-media .admin-error-message {
          margin: 12px 0 0;
          font-size: 12px;
          line-height: 1.45;
        }

        .forge-admin-media .admin-media-grid {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 16px !important;
          align-items: start;
          margin-top: 20px;
        }

        .forge-admin-media .admin-media-card {
          min-width: 0;
          overflow: hidden;
          border: 1px solid #dedfe1 !important;
          border-radius: 10px !important;
          background: #fff !important;
          box-shadow: 0 3px 12px rgba(0,0,0,.04);
        }

        .forge-admin-media .admin-media-card > div:first-child {
          aspect-ratio: 1.15 / 1;
          width: 100%;
          height: auto !important;
          min-height: 0 !important;
          overflow: hidden;
          background: #111;
        }

        .forge-admin-media .admin-media-card > div:first-child > img,
        .forge-admin-media .admin-media-card > div:first-child > video {
          display: block;
          width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          max-height: none !important;
          object-fit: cover !important;
        }

        .forge-admin-media .admin-media-card-body {
          min-height: 104px;
          padding: 11px !important;
          box-sizing: border-box;
        }

        .forge-admin-media .admin-media-card-body > p {
          margin: 0 0 9px !important;
          font-size: 11px;
          line-height: 1.35;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .forge-admin-media .admin-media-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 5px;
          margin-left: auto;
        }

        .forge-admin-media .admin-media-actions button {
          min-height: 30px;
          padding: 5px 7px;
          border: 1px solid #d9dbde;
          background: #fff;
          color: #222;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .02em;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }

        .forge-admin-media .admin-media-actions button:hover:not(:disabled) {
          background: #f4f4f2;
          border-color: #bfc2c6;
        }

        .forge-admin-media .admin-media-actions button:disabled {
          opacity: .4;
          cursor: not-allowed;
        }

        .forge-admin-media .admin-empty-state {
          margin-top: 18px;
          padding: 36px 18px;
          min-height: 120px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid #e1e2e4;
          background: #fafafa;
          text-align: center;
        }

        @media (max-width: 1180px) {
          .forge-admin-media .admin-media-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 860px) {
          .forge-admin-media .admin-media-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 560px) {
          .forge-admin-media .admin-upload-zone {
            min-height: 138px !important;
            padding: 20px 14px !important;
          }

          .forge-admin-media .admin-selected-files {
            align-items: flex-start;
            flex-direction: column;
          }

          .forge-admin-media .admin-media-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .forge-admin-media .admin-media-card > div:first-child {
            aspect-ratio: 1.35 / 1;
          }
        }
      `}</style>

    </section>
  );
}
