import { z } from 'zod';

/**
 * Simple in-memory store for prototyping and testing.
 * In a real environment, these would be database calls.
 */
const projects = new Map<string, any>();
const layers = new Map<string, any>();
const features = new Map<string, any>();

export const db = {
  projects: {
    async findById(id: string) {
      return projects.get(id);
    },
    async create(data: any) {
      const id = `proj_${Math.random().toString(36).substr(2, 9)}`;
      const project = { id, ...data };
      projects.set(id, project);
      return project;
    },
  },
  layers: {
    async findById(id: string) {
      return layers.get(id);
    },
    async create(data: any) {
      const id = `lay_${Math.random().toString(36).substr(2, 9)}`;
      const layer = { id, ...data };
      layers.set(id, layer);
      return layer;
    },
  },
  features: {
    async create(data: any) {
      const id = `feat_${Math.random().toString(36).substr(2, 9)}`;
      const feature = { id, ...data };
      features.set(id, feature);
      return feature;
    },
  },
};

export type Project = any;
export type Layer = any;
export type Feature = any;
