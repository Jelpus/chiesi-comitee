import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getAirPageData } from '@/lib/air/get-air-data';

function visitLabel(value: boolean | null) {
  if (value === true) return 'Visited';
  if (value === false) return 'Not visited';
  return 'Not identified';
}

export async function GET(request: NextRequest) {
  const marketGroup = request.nextUrl.searchParams.get('marketGroup') ?? undefined;
  const data = await getAirPageData({ marketGroup, includeRawRows: true });
  const rows = data.segmentedDoctors.map((doctor) => ({
    ims_id: doctor.imsId,
    medical_file_full_name: doctor.fullName,
    territories: doctor.territories.join(', '),
    districts: doctor.districts.join(', '),
    territories_count: doctor.territoriesCount,
    districts_count: doctor.districtsCount,
    total_visit_objective: doctor.totalVisitObjective,
    is_shared_between_territories: doctor.isSharedBetweenTerritories,
    closeup_hcp_name: doctor.closeupHcpName ?? '',
    closeup_visit_status: visitLabel(doctor.closeupVisited),
    match_score: doctor.matchScore,
    match_confidence: doctor.matchConfidence,
    matched_tokens: doctor.matchedTokens.join(', '),
    unmatched_tokens: doctor.unmatchedTokens.join(', '),
    market_rx_mat: doctor.marketRxMat,
    chiesi_rx_mat: doctor.chiesiRxMat,
    chiesi_share_mat: doctor.chiesiShareMat,
    market_volume_segment: doctor.marketVolumeSegment,
    chiesi_affinity_segment: doctor.chiesiAffinitySegment,
    air_relevance_segment: doctor.airRelevanceSegment,
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Doctor Segmentation');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
  const body = new Uint8Array(buffer);

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="air_doctor_segmentation_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
