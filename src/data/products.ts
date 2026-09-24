export type ProductType = 'stl' | 'physical';

export type Product = {
  id: string;
  name: string;
  slug: string;
  type: ProductType;
  price: number;
  oldPrice?: number;
  category: string;
  rating: number;
  reviews: number;
  badge?: string;
  description: string;
  image: string;
  details: string[];
};

export const products: Product[] = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    name: 'Suporte Modular para Celular',
    slug: 'suporte-modular-celular',
    type: 'stl',
    price: 9.9,
    oldPrice: 14.9,
    category: 'Utilidades',
    rating: 4.9,
    reviews: 127,
    badge: 'MAIS VENDIDO',
    description:
      'Um suporte compacto, elegante e fácil de imprimir para deixar seu celular sempre no lugar.',
    image:
      'https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&w=1200&q=88',
    details: [
      'Arquivo STL pronto para fatiamento',
      'Design modular',
      'Baixo consumo de material',
      'Ideal para PLA ou PETG',
    ],
  },

  {
    id: '20000000-0000-4000-8000-000000000002',
    name: 'Kit Engrenagens Mecânicas',
    slug: 'kit-engrenagens-mecanicas',
    type: 'stl',
    price: 19.9,
    oldPrice: 29.9,
    category: 'Peças Mecânicas',
    rating: 5,
    reviews: 84,
    badge: 'DESTAQUE',
    description:
      'Conjunto de engrenagens para projetos, protótipos e estudos de mecanismos.',
    image:
      'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=1200&q=88',
    details: [
      'Conjunto de arquivos STL',
      'Vários tamanhos',
      'Projeto modular',
      'Ideal para prototipagem',
    ],
  },

  {
    id: '20000000-0000-4000-8000-000000000003',
    name: 'Mini Organizador de Bancada',
    slug: 'mini-organizador-bancada',
    type: 'stl',
    price: 7.9,
    category: 'Organização',
    rating: 4.8,
    reviews: 53,
    badge: 'NOVO',
    description:
      'Organização simples e funcional para ferramentas, cabos e pequenos acessórios.',
    image:
      'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&w=1200&q=88',
    details: [
      'Arquivo STL',
      'Design compacto',
      'Impressão rápida',
      'Personalizável',
    ],
  },

  {
    id: '20000000-0000-4000-8000-000000000004',
    name: 'Miniatura Robô Industrial',
    slug: 'miniatura-robo-industrial',
    type: 'physical',
    price: 89.9,
    oldPrice: 109.9,
    category: 'Colecionáveis',
    rating: 4.9,
    reviews: 41,
    badge: 'OFERTA',
    description:
      'Miniatura impressa em 3D com acabamento premium para decoração ou coleção.',
    image:
      'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1200&q=88',
    details: [
      'Peça física impressa',
      'Escolha de cores',
      'Acabamento premium',
      'Produção sob demanda',
    ],
  },

  {
    id: '20000000-0000-4000-8000-000000000005',
    name: 'Suporte para Controle Gamer',
    slug: 'suporte-controle-gamer',
    type: 'stl',
    price: 12.9,
    category: 'Games',
    rating: 4.9,
    reviews: 72,
    badge: 'POPULAR',
    description:
      'Suporte estiloso para controles, pensado para impressão rápida e ótimo aproveitamento.',
    image:
      'https://images.unsplash.com/photo-1605901309584-818e25960a8f?auto=format&fit=crop&w=1200&q=88',
    details: [
      'Arquivo STL',
      'Base estável',
      'Impressão simples',
      'PLA recomendado',
    ],
  },

  {
    id: '20000000-0000-4000-8000-000000000006',
    name: 'Peça Personalizada — Impressão 3D',
    slug: 'peca-personalizada-impressao-3d',
    type: 'physical',
    price: 49.9,
    category: 'Sob Demanda',
    rating: 5,
    reviews: 18,
    badge: 'PERSONALIZE',
    description:
      'Envie seu modelo e nós produzimos sua peça em 3D sob demanda.',
    image:
      'https://images.unsplash.com/photo-1631541911232-4c7a6a3f1f2a?auto=format&fit=crop&w=1200&q=88',
    details: [
      'Produção sob demanda',
      'Escolha de material e cor',
      'Orçamento personalizado',
      'Envio para todo o Brasil',
    ],
  },
];

export const categories = [
  'Todos',
  'Peças Mecânicas',
  'Games',
  'Utilidades',
  'Organização',
  'Colecionáveis',
  'Sob Demanda',
];