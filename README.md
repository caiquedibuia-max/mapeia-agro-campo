# MapeiaAgro Campo

O companheiro de campo do [MapeiaAgro](https://github.com/caiquedibuia-max/mapeia-agro-linhas-plantio) — uma página só, para abrir no celular dentro do talhão.

**Abra em:** https://caiquedibuia-max.github.io/mapeia-agro-campo/

## O que ele faz

- Abre o projeto que saiu do computador (`.talhao.json`) e mostra as linhas sobre a imagem de satélite
- Mostra onde você está, com altitude, precisão e velocidade
- Mede **distância** e **área** — tocando no mapa ou andando com o GPS
- Marca pontos (mata, poste, erosão, formigueiro…) para levar de volta
- Mostra o tempo: temperatura, vento e a previsão de 7 dias

O que você marcar volta num arquivo de ~1 KB. No computador, é só arrastar para o MapeiaAgro: as marcações viram pinos, as distâncias viram referências e as **áreas viram partes medidas, já com as exclusões descontadas**.

## Por que isto está hospedado, e não é só um arquivo

O Chrome do Android **não libera o GPS para página aberta como arquivo local** — nega sem nem perguntar. O mesmo arquivo no computador funciona, o que confunde. Para o GPS funcionar, a página precisa vir de um endereço `https://`. É só para isto que este repositório existe.

## Este arquivo não se edita aqui

`index.html` é cópia do `campo.html` do repositório principal. Mexa lá e copie para cá — editar direto aqui cria duas versões que vão divergir.

## De onde vêm os dados

- Imagem de satélite: ArcGIS World Imagery
- Mapa: [Leaflet](https://leafletjs.com/)
- Tempo e busca de cidade: [Open-Meteo](https://open-meteo.com/) — sem chave, sem cadastro

A previsão usa a sua coordenada **arredondada a duas casas (~1 km)**: o modelo não tem resolução melhor que isso, então a posição exata não acrescentaria nada e não precisa sair do aparelho. Nada mais é enviado para lugar nenhum — o projeto, as marcações e as medições ficam só no seu celular.
