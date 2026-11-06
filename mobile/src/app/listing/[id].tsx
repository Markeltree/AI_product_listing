import React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { MAX_QUANTITY, MIN_PRICE } from '@/lib/rules';
import { STATUS_LABEL } from '@/lib/format';
import { useListingEditor } from '@/hooks/useListingEditor';
import { Banner, Card, CardHeader } from '@/components/ui';
import { AiNotesCard } from '@/components/listings/editor/AiNotesCard';
import { AttributesEditor } from '@/components/listings/editor/AttributesEditor';
import { CategoryPicker } from '@/components/listings/editor/CategoryPicker';
import { CopySection, TagsSection } from '@/components/listings/editor/CopySection';
import { EditorActionBar, SaveStatus } from '@/components/listings/editor/EditorBits';
import { GeneratingCard } from '@/components/listings/editor/GeneratingCard';
import { ListingPreview } from '@/components/listings/editor/ListingPreview';
import { PhotosEditor } from '@/components/listings/editor/PhotosEditor';
import { ReadinessChecklist } from '@/components/listings/editor/ReadinessChecklist';
import { ShopDetailsSection } from '@/components/listings/editor/ShopDetailsSection';
import { MarketplacesCard } from '@/components/marketplaces/MarketplacesCard';
import { colors, space } from '@/theme';

export default function ListingEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const editor = useListingEditor(id);
  const { listing, draft, etsy, banner, errorOf, issueFor, publishTried } = editor;

  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: 'Edit listing',
        headerBackTitle: 'Listings',
        headerTintColor: colors.ink,
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerShadowVisible: false,
        headerRight: () => (
          listing && listing.status !== 'generating' ? (
            <Pressable onPress={editor.regenerate} accessibilityRole="button" accessibilityLabel="Regenerate copy" hitSlop={10} style={styles.rewrite}>
              <Ionicons name="sparkles" size={15} color={colors.accent} />
              <Text style={styles.rewriteText}>Rewrite</Text>
            </Pressable>
          ) : null
        ),
      }}
    />
  );

  if (editor.loadError && !listing) {
    return (
      <View style={[styles.page, styles.centered, { padding: space.lg, gap: space.md }]}>
        {header}
        <Banner tone="error" text={editor.loadError} action={{ label: 'Try again', onPress: editor.load }} />
      </View>
    );
  }

  if (!listing || !draft) {
    return (
      <View style={[styles.page, styles.centered, { alignItems: 'center' }]}>
        {header}
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (listing.status === 'generating') {
    return (
      <View style={[styles.page, styles.centered, { padding: space.xl, gap: space.md }]}>
        {header}
        <GeneratingCard step={listing.step} />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      {header}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SaveStatus status={listing.status} dirty={editor.dirty} updatedAt={listing.updatedAt} />

        {listing.status === 'failed' && listing.error ? (
          <Banner tone="error" title={STATUS_LABEL.failed} text={listing.error} />
        ) : null}
        {banner ? <Banner tone={banner.tone} title={banner.title} text={banner.text} action={banner.action} /> : null}
        {!etsy?.connected ? (
          <Banner tone="info" text="Connect your Etsy shop in Settings to publish from here. You can keep editing without it." />
        ) : null}

        <ListingPreview
          listingId={listing.id}
          coverId={editor.images[0]?.id}
          price={draft.product.price}
          title={draft.content.title}
          shopName={etsy?.shopName}
          isSupply={draft.product.isSupply}
        />

        <PhotosEditor
          listingId={listing.id}
          media={draft.media}
          altTexts={draft.content.altTexts}
          onAltChange={editor.setAlt}
          onMove={editor.movePhoto}
          onRemove={editor.removePhoto}
          onAdd={editor.addPhotos}
          adding={editor.busy === 'photo'}
        />

        <CopySection
          title={draft.content.title}
          description={draft.content.description}
          onChange={editor.setContent}
          titleError={errorOf('title')}
          descriptionError={issueFor('description')?.message}
        />

        <TagsSection tags={draft.content.tags} onChange={(tags) => editor.setContent({ tags })} />

        <Card>
          <CardHeader icon="folder-open-outline" title="Category" />
          <CategoryPicker
            taxonomyId={draft.product.taxonomyId}
            taxonomyPath={draft.product.taxonomyPath}
            onChoose={editor.chooseCategory}
            error={publishTried ? issueFor('taxonomyId')?.message : undefined}
          />
          <View style={styles.divider} />
          <AttributesEditor attributes={draft.content.attributes} onChange={(attributes) => editor.setContent({ attributes })} />
        </Card>

        <ShopDetailsSection
          product={draft.product}
          priceText={editor.priceText}
          qtyText={editor.qtyText}
          readyText={editor.readyText}
          onPrice={editor.onPrice}
          onQuantity={editor.onQuantity}
          onReadiness={editor.onReadiness}
          onChange={editor.setProduct}
          shopConnected={!!(etsy?.connected && etsy.hasShop)}
          shipping={editor.shipping}
          errors={{
            price: errorOf('price', publishTried || editor.priceText !== ''),
            quantity: issueFor('quantity')?.message,
            shippingProfileId: publishTried ? issueFor('shippingProfileId')?.message : undefined,
          }}
        />

        <ReadinessChecklist product={draft.product} content={draft.content} photoCount={editor.photoCount} ready={editor.publishable} />

        <MarketplacesCard listing={listing} onListing={editor.adopt} saveFirst={editor.saveIfDirty} />

        {listing.analysis ? (
          <AiNotesCard
            analysis={listing.analysis}
            suggestedPrice={listing.content.suggestedPrice}
            pricingNote={listing.content.pricingNote}
            onUsePrice={editor.applySuggestedPrice}
          />
        ) : null}

        {draft.product.price !== null && draft.product.price < MIN_PRICE ? (
          <Banner tone="warn" text={`Etsy requires a price of at least $${MIN_PRICE.toFixed(2)}.`} />
        ) : null}
        {Number(editor.qtyText) > MAX_QUANTITY ? <Banner tone="warn" text={`Quantity can be at most ${MAX_QUANTITY}.`} /> : null}
      </ScrollView>

      <EditorActionBar dirty={editor.dirty} busy={editor.busy} onSave={editor.save} onSaveDraft={() => editor.publish('draft')} onPublish={() => editor.publish('active')} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  centered: { justifyContent: 'center' },
  content: { padding: space.lg + 2, gap: space.md + 2, paddingBottom: 170 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 2 },
  rewrite: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.accent50, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, marginRight: Platform.OS === 'web' ? 14 : 0 },
  rewriteText: { fontSize: 13, fontWeight: '700', color: colors.accentDark },
});
