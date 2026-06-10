'use client'

export default function Home() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Sistema de Importação de Peças</h1>
      <p>Bem-vindo ao sistema de importação!</p>
      <p>
        Acesse o módulo oficial em{' '}
        <a href="/importacoes/pecas">Importação de Peças</a>
      </p>
      <p>
        Consulte execuções anteriores em{' '}
        <a href="/importacoes/historico">Histórico de Importações</a>
      </p>
      <p>
        A tela técnica continua disponível em{' '}
        <a href="/test-import">/test-import</a>
      </p>
    </div>
  )
}
