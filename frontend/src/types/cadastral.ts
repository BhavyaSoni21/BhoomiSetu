export interface CadastralVillageSummary {
  code: string;
  name: string;
  category: string;
  parcelCount: number;
  bbox: [number, number, number, number];
  center: [number, number];
}

export interface CadastralTalukaSummary {
  talukaName: string;
  villages: CadastralVillageSummary[];
}

export interface CadastralDistrictSummary {
  districtName: string;
  category: string;
  talukas: CadastralTalukaSummary[];
}

export interface CadastralHierarchy {
  stateCode: string;
  stateName: string;
  districts: CadastralDistrictSummary[];
}

export interface CadastralPlotProperties {
  id: string;
  plotno: string;
  area: number;
  cat?: string;
  giscode?: string;
}

export interface CadastralFeature {
  type: 'Feature';
  id: string;
  properties: CadastralPlotProperties;
  geometry: GeoJSON.Geometry;
}

export interface CadastralVillageGeoJSON {
  type: 'FeatureCollection';
  villageCode: string;
  features: CadastralFeature[];
}

export interface CadastralPlotDetail {
  plotid: string;
  villageCode: string;
  villageName: string;
  plotno: string;
  giscode: string;
  area: number;
  category: string;
  district: string;
  taluka: string;
  bounds: [number, number, number, number];
  rawInfo: string;
  parsedInfo: {
    holders: string[];
    attributes: Record<string, string>;
    ownerName?: string;
    surveyNo?: string;
    sheetNo?: string;
    pageNo?: string;
    street?: string;
    tenure?: string;
    khataNo?: string;
    potKharaba?: string;
    areaRecorded?: string;
  };
}
