import { CommercetoolsSourceConnector } from '../packages/connectors/src/commercetools/ct-source.connector';
import { ShopifyTargetConnector } from '../packages/connectors/src/shopify/shopify-target.connector';
import { requestShopifyToken } from '../packages/connectors/src/shopify/shopify-oauth';
import { EntityType } from '../packages/shared/src/enums';
import { IdentityTargetDecorator } from '../apps/worker-etl/src/orchestrator/identity-target.decorator';
import { IdentityMapRepository } from '../packages/db/src/repositories/identity-map.repository';
import { IdentityMap } from '../packages/db/src/schemas/identity-map.schema';
import mongoose from 'mongoose';

async function main() {
    await mongoose.connect('mongodb://localhost:27017/cdo');
    const repo = new IdentityMapRepository(IdentityMap as any);

    const ctCreds = {
        projectKey: process.env.CTP_PROJECT_KEY,
        clientId: process.env.CTP_CLIENT_ID,
        clientSecret: process.env.CTP_CLIENT_SECRET,
        apiUrl: process.env.CTP_API_URL,
        authUrl: process.env.CTP_AUTH_URL,
        scopes: ['manage_project'],
    };

    const { accessToken } = await requestShopifyToken(
        process.env.SHOPIFY_SHOP!,
        process.env.SHOPIFY_CLIENT_ID!,
        process.env.SHOPIFY_CLIENT_SECRET!
    );

    const source = new CommercetoolsSourceConnector(EntityType.CATEGORIES);
    await source.initialize(ctCreds as any);

    const target = new ShopifyTargetConnector(EntityType.CATEGORIES);
    await target.initialize({
        shopName: process.env.SHOPIFY_SHOP!,
        accessToken,
    });

    const decorator = new IdentityTargetDecorator(
        target as any,
        repo as any,
        't1',
        'proj_test',
        EntityType.CATEGORIES,
        'job_1'
    );

    console.log('Extracting from CT...');
    let extracted = [];
    for await (const batch of source.extract()) {
        extracted.push(...batch);
        break; // just 1 batch
    }
    extracted = extracted.slice(0, 2);

    console.log(`Loading ${extracted.length} items to Shopify via Decorator...`);
    await decorator.load(extracted);

    console.log('Querying MongoDB for IdentityMaps...');
    const maps = await mongoose.model('IdentityMap').find({ migrationProjectId: 'proj_test' });
    console.log(JSON.stringify(maps, null, 2));

    await mongoose.disconnect();
}

main().catch(console.error);
