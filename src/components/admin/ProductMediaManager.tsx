
import { useEffect, useRef, useState } from 'react';
import {
  ImagePlus,
  Loader2,
  Star,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';

import { supabase } from '../../lib/supabase';

type MediaType = 'image' | 'video';

interface ProductMedia {
  id: string;
  product_id: string;
  media_type: MediaType;
  media_url: string;
  thumbnail_url: string | null;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

interface ProductMediaManagerProps {
  productId: string;
}

const BUCKET_NAME = 'product-media';

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

export function ProductMediaManager({
  productId,
}: ProductMediaManagerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [media, setMedia] = useState<ProductMedia[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(
    null,
  );

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadMedia();
  }, [productId]);

  async function loadMedia() {
    try {
      setLoading(true);
      setError('');

      const { data, error: queryError } = await supabase
        .from('product_media')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order', {
          ascending: true,
        })
        .order('created_at', {
          ascending: true,
        });

      if (queryError) {
        throw queryError;
      }

      setMedia((data || []) as ProductMedia[]);
    } catch (err) {
      console.error('Erro ao carregar mídias:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar as mídias.',
      );
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelection(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files || []);

    if (!files.length) {
      return;
    }

    setError('');
    setSuccess('');

    const validFiles: File[] = [];

    for (const file of files) {
      const isImage = IMAGE_TYPES.includes(file.type);
      const isVideo = VIDEO_TYPES.includes(file.type);

      if (!isImage && !isVideo) {
        setError(
          `O arquivo "${file.name}" possui um formato não permitido.`,
        );
        continue;
      }

      if (isImage && file.size > MAX_IMAGE_SIZE) {
        setError(
          `A imagem "${file.name}" ultrapassa o limite de 10 MB.`,
        );
        continue;
      }

      if (isVideo && file.size > MAX_VIDEO_SIZE) {
        setError(
          `O vídeo "${file.name}" ultrapassa o limite de 100 MB.`,
        );
        continue;
      }

      validFiles.push(file);
    }

    setSelectedFiles((currentFiles) => [
      ...currentFiles,
      ...validFiles,
    ]);

    event.target.value = '';
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((currentFiles) =>
      currentFiles.filter((_, fileIndex) => fileIndex !== index),
    );
  }

  function createSafeFileName(fileName: string) {
    const extension = fileName.includes('.')
      ? fileName.substring(fileName.lastIndexOf('.'))
      : '';

    const baseName = fileName
      .replace(/\.[^/.]+$/, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase();

    const uniqueId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 10)}`;

    return `${uniqueId}-${baseName || 'arquivo'}${extension.toLowerCase()}`;
  }

  async function uploadFiles() {
    if (!selectedFiles.length) {
      setError('Selecione pelo menos uma imagem ou vídeo.');
      return;
    }

    try {
      setUploading(true);
      setError('');
      setSuccess('');

      const uploadedMedia: ProductMedia[] = [];

      for (const file of selectedFiles) {
        const isVideo = VIDEO_TYPES.includes(file.type);
        const mediaType: MediaType = isVideo ? 'video' : 'image';

        const safeFileName = createSafeFileName(file.name);

        const storagePath = `${productId}/${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) {
          throw uploadError;
        }

        const {
          data: publicUrlData,
        } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(storagePath);

        const mediaUrl = publicUrlData.publicUrl;

        const { data: insertedMedia, error: insertError } =
          await supabase
            .from('product_media')
            .insert({
              product_id: productId,
              media_type: mediaType,
              media_url: mediaUrl,
              thumbnail_url: null,
              alt_text: file.name,
              sort_order: media.length + uploadedMedia.length,
              is_primary:
                mediaType === 'image' &&
                media.length === 0 &&
                uploadedMedia.length === 0,
            })
            .select()
            .single();

        if (insertError) {
          await supabase.storage
            .from(BUCKET_NAME)
            .remove([storagePath]);

          throw insertError;
        }

        uploadedMedia.push(insertedMedia as ProductMedia);
      }

      setMedia((currentMedia) => [
        ...currentMedia,
        ...uploadedMedia,
      ]);

      setSelectedFiles([]);
      setSuccess(
        `${uploadedMedia.length} arquivo(s) enviado(s) com sucesso.`,
      );
    } catch (err) {
      console.error('Erro ao enviar mídias:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível enviar os arquivos.',
      );
    } finally {
      setUploading(false);
    }
  }

  async function setPrimaryMedia(mediaItem: ProductMedia) {
    if (mediaItem.media_type !== 'image') {
      setError('A mídia principal precisa ser uma imagem.');
      return;
    }

    try {
      setSettingPrimaryId(mediaItem.id);
      setError('');
      setSuccess('');

      const { error: resetError } = await supabase
        .from('product_media')
        .update({
          is_primary: false,
        })
        .eq('product_id', productId);

      if (resetError) {
        throw resetError;
      }

      const { error: primaryError } = await supabase
        .from('product_media')
        .update({
          is_primary: true,
        })
        .eq('id', mediaItem.id);

      if (primaryError) {
        throw primaryError;
      }

      setMedia((currentMedia) =>
        currentMedia.map((item) => ({
          ...item,
          is_primary: item.id === mediaItem.id,
        })),
      );

      setSuccess('Imagem principal atualizada.');
    } catch (err) {
      console.error(
        'Erro ao definir imagem principal:',
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível definir a imagem principal.',
      );
    } finally {
      setSettingPrimaryId(null);
    }
  }

  async function deleteMedia(mediaItem: ProductMedia) {
    const confirmed = window.confirm(
      'Deseja realmente excluir esta mídia?',
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(mediaItem.id);
      setError('');
      setSuccess('');

      const mediaUrl = mediaItem.media_url;

      const bucketMarker = `/storage/v1/object/public/${BUCKET_NAME}/`;

      const storagePath = mediaUrl.includes(bucketMarker)
        ? decodeURIComponent(
            mediaUrl.split(bucketMarker)[1],
          )
        : null;

      const { error: deleteError } = await supabase
        .from('product_media')
        .delete()
        .eq('id', mediaItem.id);

      if (deleteError) {
        throw deleteError;
      }

      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([storagePath]);

        if (storageError) {
          console.warn(
            'Mídia excluída da tabela, mas houve erro ao excluir o arquivo:',
            storageError,
          );
        }
      }

      setMedia((currentMedia) =>
        currentMedia.filter(
          (item) => item.id !== mediaItem.id,
        ),
      );

      setSuccess('Mídia excluída com sucesso.');
    } catch (err) {
      console.error('Erro ao excluir mídia:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível excluir a mídia.',
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="admin-media-manager">
      <div className="admin-media-header">
        <div>
          <h3>Imagens e vídeos do produto</h3>

          <p>
            Adicione várias imagens e vídeos para exibir na
            página de detalhes do produto.
          </p>
        </div>

        <button
          type="button"
          className="admin-button admin-button-secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <ImagePlus size={18} />
          Selecionar arquivos
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={[
          ...IMAGE_TYPES,
          ...VIDEO_TYPES,
        ].join(',')}
        multiple
        hidden
        onChange={handleFileSelection}
      />

      <div
        className="admin-upload-zone"
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            fileInputRef.current?.click();
          }
        }}
      >
        <Upload size={30} />

        <strong>
          Clique para selecionar imagens ou vídeos
        </strong>

        <span>
          Imagens até 10 MB e vídeos até 100 MB
        </span>
      </div>

      {selectedFiles.length > 0 && (
        <div className="admin-selected-files">
          <h4>Arquivos selecionados</h4>

          {selectedFiles.map((file, index) => (
            <div
              className="admin-selected-file"
              key={`${file.name}-${index}`}
            >
              <div>
                <strong>{file.name}</strong>

                <small>
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </small>
              </div>

              <button
                type="button"
                onClick={() => removeSelectedFile(index)}
                disabled={uploading}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          <button
            type="button"
            className="admin-button admin-button-primary"
            onClick={uploadFiles}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2
                  size={18}
                  className="admin-spin"
                />
                Enviando...
              </>
            ) : (
              <>
                <Upload size={18} />
                Enviar arquivos
              </>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="admin-error-message">
          {error}
        </div>
      )}

      {success && (
        <div className="admin-success-message">
          {success}
        </div>
      )}

      <div className="admin-media-content">
        <h4>
          Mídias cadastradas ({media.length})
        </h4>

        {loading ? (
          <div className="admin-media-loading">
            <Loader2
              size={24}
              className="admin-spin"
            />

            Carregando mídias...
          </div>
        ) : media.length === 0 ? (
          <div className="admin-media-empty">
            Nenhuma imagem ou vídeo cadastrado.
          </div>
        ) : (
          <div className="admin-media-grid">
            {media.map((mediaItem) => (
              <article
                className="admin-media-card"
                key={mediaItem.id}
              >
                <div className="admin-media-preview">
                  {mediaItem.media_type === 'image' ? (
                    <img
                      src={mediaItem.media_url}
                      alt={
                        mediaItem.alt_text ||
                        'Imagem do produto'
                      }
                    />
                  ) : (
                    <video
                      src={mediaItem.media_url}
                      controls
                      preload="metadata"
                    />
                  )}

                  {mediaItem.is_primary && (
                    <span className="admin-primary-badge">
                      <Star size={14} />
                      Principal
                    </span>
                  )}

                  {mediaItem.media_type === 'video' && (
                    <span className="admin-video-badge">
                      <Video size={14} />
                      Vídeo
                    </span>
                  )}
                </div>

                <div className="admin-media-card-body">
                  <span>
                    {mediaItem.media_type === 'image'
                      ? 'Imagem'
                      : 'Vídeo'}
                  </span>

                  <div className="admin-media-actions">
                    {mediaItem.media_type === 'image' && (
                      <button
                        type="button"
                        className="admin-media-action"
                        onClick={() =>
                          setPrimaryMedia(mediaItem)
                        }
                        disabled={
                          mediaItem.is_primary ||
                          settingPrimaryId === mediaItem.id
                        }
                      >
                        {settingPrimaryId === mediaItem.id ? (
                          <Loader2
                            size={15}
                            className="admin-spin"
                          />
                        ) : (
                          <Star size={15} />
                        )}

                        {mediaItem.is_primary
                          ? 'Principal'
                          : 'Definir principal'}
                      </button>
                    )}

                    <button
                      type="button"
                      className="admin-media-delete"
                      onClick={() => deleteMedia(mediaItem)}
                      disabled={deletingId === mediaItem.id}
                    >
                      {deletingId === mediaItem.id ? (
                        <Loader2
                          size={15}
                          className="admin-spin"
                        />
                      ) : (
                        <Trash2 size={15} />
                      )}

                      Excluir
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
