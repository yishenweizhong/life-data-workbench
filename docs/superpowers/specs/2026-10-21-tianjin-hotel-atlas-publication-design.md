# Tianjin Hotel Atlas Publication Design

## Goal

Publish the existing Tianjin hotel atlas as a public, shareable website while preserving all existing GitHub Pages content.

## Architecture

- Reuse the public `yishenweizhong/life-data-workbench` repository and its existing GitHub Pages deployment from `main/docs`.
- Add the complete static application under `docs/tianjin-hotel-atlas/`.
- Keep all application assets relative to that directory so the product works at:
  `https://yishenweizhong.github.io/life-data-workbench/tianjin-hotel-atlas/`
- Do not add a backend. The bundled 169-hotel dataset is public and identical for every visitor.
- Browser imports and edits remain local to each visitor through `localStorage`; they are not shared.

## Deployment Scope

The deployment adds only the new product directory and these engineering records. Existing workbench HTML files, downloads, previews, and the Pages configuration remain unchanged.

## Public Data And Map

- All files under the product directory are publicly downloadable.
- The AMap JavaScript key and security code are client-side credentials and remain visible to visitors, as required by a static web deployment.
- The existing AMap domain policy must allow `yishenweizhong.github.io`; online verification will detect a domain restriction.

## Verification

1. Run the existing core JavaScript tests.
2. Serve the copied `docs` directory locally and run the marker UI test against the deployed subpath.
3. Push the deployment commit to `main`.
4. Wait for the GitHub Pages build to complete.
5. Verify the public URL returns HTTP 200.
6. Verify the map renders 169 hotel markers.
7. Select `北京昱海黑科技有限公司` and verify 39 markers remain.
8. Verify a mobile viewport loads without horizontal overflow.

