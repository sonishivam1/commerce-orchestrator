import {
    Controller,
    Get,
    Param,
    Req,
    Res,
    NotFoundException,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { basename } from 'path';
import { MigrationRunRepository } from '@cdo/db';

/**
 * Serves the file produced by an EXPORT-mode MigrationRun.
 * JWT-guarded and scoped to the caller's organization.
 */
@Controller('runs')
export class ExportController {
    constructor(private readonly runRepository: MigrationRunRepository) {}

    @Get(':id/export')
    @UseGuards(AuthGuard('jwt'))
    async download(
        @Param('id') id: string,
        @Req() req: { user?: { tenantId?: string } },
        @Res() res: {
            setHeader(name: string, value: string): void;
            pipe?: unknown;
        } & NodeJS.WritableStream,
    ): Promise<void> {
        const tenantId = req.user?.tenantId;
        if (!tenantId) throw new NotFoundException('Run not found');

        const run = await this.runRepository.findOneForTenant(tenantId, id);
        if (!run || !run.export?.filePath) {
            throw new NotFoundException('No export file for this run');
        }

        const { filePath, format } = run.export;
        try {
            await stat(filePath);
        } catch {
            throw new NotFoundException('Export file is no longer available');
        }

        const contentType = format === 'CSV' ? 'text/csv' : 'application/json';
        res.setHeader('Content-Type', contentType);
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${basename(filePath)}"`,
        );
        createReadStream(filePath).pipe(res);
    }
}
